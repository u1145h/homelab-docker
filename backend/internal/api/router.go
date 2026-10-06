package api

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"

	"github.com/ullashroy/poco-server/backend/internal/audit"
	"github.com/ullashroy/poco-server/backend/internal/auth"
	"github.com/ullashroy/poco-server/backend/internal/camera"
	"github.com/ullashroy/poco-server/backend/internal/docker"
	"github.com/ullashroy/poco-server/backend/internal/filemanager"
	"github.com/ullashroy/poco-server/backend/internal/history"
	"github.com/ullashroy/poco-server/backend/internal/kuro"
	"github.com/ullashroy/poco-server/backend/internal/notifications"
	"github.com/ullashroy/poco-server/backend/internal/preferences"
	"github.com/ullashroy/poco-server/backend/internal/state"
	"github.com/ullashroy/poco-server/backend/internal/terminal"
	"github.com/ullashroy/poco-server/backend/internal/users"
)

func NewRouter(
	st *state.State,
	us *users.Service,
	as *audit.Service,
	ds *docker.Service,
	ts *terminal.Service,
	fs *filemanager.Service,
	hs *history.Service,
	cs *camera.Service,
	prefsStore *preferences.Store,
	notifStore *notifications.Store,
	ks *kuro.Service,
) http.Handler {

	// Hook up user token version validator for instant session invalidation
	if us != nil {
		auth.UserTokenVersionValidator = func(username string, tokenVersion int) bool {
			user, err := us.GetByUsername(username)
			if err != nil || user == nil {
				return false
			}
			return tokenVersion >= user.TokenVersion
		}
	}

	// Hook up session revocation validator & live touch handler
	if ks != nil {
		auth.SessionRevocationValidator = func(sessionID string) bool {
			if ks.Store != nil && ks.Store.IsSessionRevoked(sessionID) {
				return true
			}
			if ks.DB != nil && ks.DB.IsSessionRevoked(sessionID) {
				return true
			}
			return false
		}
		auth.SessionTouchHandler = func(sessionID string) {
			if ks.Store != nil {
				_ = ks.Store.TouchSession(sessionID)
			}
			if ks.DB != nil {
				_ = ks.DB.TouchUserSession(sessionID)
			}
		}
	}

	r := chi.NewRouter()

	// Strict Anti-Indexing & Privacy Header Middleware
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet, noimageindex")
			next.ServeHTTP(w, r)
		})
	})

	r.Use(cors.Handler(cors.Options{
		AllowOriginFunc: func(r *http.Request, origin string) bool {
			return true
		},
		AllowedMethods: []string{
			"GET",
			"POST",
			"PUT",
			"DELETE",
			"OPTIONS",
		},
		AllowedHeaders: []string{
			"Accept",
			"Authorization",
			"Content-Type",
			"X-CSRF-Token",
			"X-Node-ID",
			"X-Node-Secret",
			"X-Requested-With",
			"Range",
		},
		ExposedHeaders: []string{
			"Content-Range",
			"Accept-Ranges",
			"Content-Length",
			"Content-Disposition",
		},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// ---------------------------------------------------------------------
	// Public Routes (Health, Login, Static Media)
	// ---------------------------------------------------------------------

	r.Get("/api/v1/health", HealthHandler)
	r.Post("/api/v1/login", LoginHandler(us, ks))
	r.Post("/api/v1/logout", LogoutHandler(ks))
	r.Get("/api/v1/auth", AuthHandler(us))

	// Kuro Public (Health, Node WebSocket Hub, & Media Proxy)
	r.Get("/api/v1/kuro/health", KuroHealthHandler(ks))
	r.Get("/api/v1/kuro/ws/node", KuroNodeWebSocketHandler(ks))
	r.Get("/api/v1/kuro/ws", KuroNodeWebSocketHandler(ks))
	r.Get("/ws/node", KuroNodeWebSocketHandler(ks))
	r.Get("/ws/kuro", KuroNodeWebSocketHandler(ks))
	r.Get("/api/v1/kuro/integrations/immich/asset/{id}/thumbnail", KuroImmichThumbnailProxyHandler(ks))
	r.Get("/api/v1/immich/thumbnail/{id}", KuroImmichThumbnailProxyHandler(ks))

	// Host Hardware Telemetry Ingestion (Receives real Win32/Darwin/Linux host companion metrics)
	r.Post("/api/v1/host/telemetry", HostTelemetryHandler(st))

	// ---------------------------------------------------------------------
	// Protected Endpoints
	// ---------------------------------------------------------------------

	r.Group(func(r chi.Router) {

		r.Use(auth.Middleware)

		// 2FA Setup, Verification & Disable (Available to all interactive users)
		r.Post("/api/v1/auth/2fa/setup", Setup2FAHandler(us))
		r.Post("/api/v1/auth/2fa/verify", Verify2FAHandler(us))
		r.Post("/api/v1/auth/2fa/disable", Disable2FAHandler(us))

		// Node Telemetry & Sync Endpoint (Accessible by client role, user role, and admin)
		r.Post("/api/v1/kuro/nodes/{id}/sync", KuroNodeSyncHandler(ks))

		// -----------------------------------------------------------------
		// Kuro AI Interactive Assistant Endpoints (Admin & User roles only)
		// -----------------------------------------------------------------
		r.Group(func(r chi.Router) {
			r.Use(auth.RequireKuroUser)

			r.Route("/api/v1/kuro", func(r chi.Router) {
				r.Get("/health", KuroGetHealthHandler(ks))
				r.Get("/conversations", KuroListConversationsHandler(ks))
				r.Post("/conversations", KuroCreateConversationHandler(ks))
				r.Get("/conversations/{id}", KuroGetConversationHandler(ks))
				r.Put("/conversations/{id}", KuroUpdateConversationHandler(ks))
				r.Delete("/conversations/{id}", KuroDeleteConversationHandler(ks))
				r.Get("/conversations/{id}/messages", KuroListMessagesHandler(ks))
				r.Post("/conversations/{id}/messages", KuroSendMessageHandler(ks))
				r.Post("/conversations/{id}/messages/sync", KuroSyncDirectMessagesHandler(ks))
				r.Get("/memories", KuroListMemoriesHandler(ks))
				r.Post("/memories", KuroCreateMemoryHandler(ks))
				r.Put("/memories/{id}", KuroUpdateMemoryHandler(ks))
				r.Delete("/memories/{id}", KuroDeleteMemoryHandler(ks))
				r.Get("/nodes", KuroListNodesHandler(ks))
				r.Put("/nodes/{id}", KuroUpdateNodeHandler(ks))
				r.Delete("/nodes/{id}", KuroDeleteNodeHandler(ks))
				r.Get("/nodes/{id}/snapshot", KuroGetNodeSnapshotHandler(ks))
				r.Get("/nodes/{id}/data", KuroGetNodeDataHandler(ks))
				r.Get("/nodes/{id}/files", KuroNodeFilesListHandler(ks))
				r.Get("/nodes/{id}/files/roots", KuroNodeFileRootsHandler(ks))
				r.Post("/nodes/{id}/files/upload", KuroNodeFileUploadHandler(ks))
				r.Post("/nodes/{id}/files/delete", KuroNodeFileDeleteHandler(ks))
				r.Post("/nodes/{id}/files/mkdir", KuroNodeFileMkdirHandler(ks))
				r.Post("/nodes/{id}/files/rename", KuroNodeFileRenameHandler(ks))
				r.Get("/nodes/{id}/file-content", KuroNodeFileContentHandler(ks))
				r.Post("/nodes/{id}/live-track", KuroToggleLiveTrackHandler(ks))
				r.Get("/nodes/{id}/hardware/cameras", KuroNodeCameraListHandler(ks))
				r.Get("/nodes/{id}/hardware/microphones", KuroNodeMicListHandler(ks))
				r.Post("/nodes/{id}/hardware/camera/capture", KuroNodeCameraCaptureHandler(ks))
				r.Post("/nodes/{id}/hardware/camera/record", KuroNodeCameraRecordHandler(ks))
				r.Post("/nodes/{id}/hardware/camera/stream", KuroNodeCameraStreamControlHandler(ks))
				r.Get("/nodes/{id}/hardware/camera/stream/frame", KuroNodeCameraStreamFrameHandler(ks))
				r.Post("/nodes/{id}/hardware/mic/record", KuroNodeMicRecordHandler(ks))
				r.Post("/nodes/{id}/hardware/mic/stream", KuroNodeMicStreamControlHandler(ks))
				r.Get("/nodes/{id}/system/status", KuroNodeSystemStatusHandler(ks))
				r.Post("/nodes/{id}/system/setting", KuroNodeSystemSettingHandler(ks))
				r.Post("/nodes/{id}/system/action", KuroNodeSystemActionHandler(ks))
				r.Get("/nodes/{id}/processes", KuroNodeProcessesListHandler(ks))
				r.Post("/nodes/{id}/processes/kill", KuroNodeProcessKillHandler(ks))
				r.Get("/nodes/{id}/services", KuroNodeServicesListHandler(ks))
				r.Post("/nodes/{id}/services/control", KuroNodeServiceControlHandler(ks))
				r.Get("/nodes/{id}/apps", KuroNodeAppsListHandler(ks))
				r.Get("/nodes/{id}/ports", KuroNodePortsListHandler(ks))
				r.Get("/nodes/{id}/power", KuroNodePowerInfoHandler(ks))
				r.Post("/nodes/{id}/power/scheme", KuroNodePowerSchemeHandler(ks))
				r.Get("/nodes/{id}/events", KuroNodeEventsListHandler(ks))
				r.Get("/nodes/{id}/screenshot", KuroNodeScreenshotHandler(ks))
				r.Get("/nodes/{id}/clipboard", KuroNodeGetClipboardHandler(ks))
				r.Post("/nodes/{id}/clipboard", KuroNodeSetClipboardHandler(ks))
				r.Post("/nodes/{id}/toast", KuroNodeSendToastHandler(ks))
				r.Post("/nodes/{id}/sync-trigger", KuroTriggerSyncNodeHandler(ks))
				r.Post("/nodes/{id}/sync-now", KuroTriggerSyncNodeHandler(ks))
				r.Post("/nodes/{id}/import", KuroImportClientDataHandler(ks))
				r.Post("/nodes/sync-all", KuroTriggerSyncAllHandler(ks))
				r.Get("/client-data", KuroGetClientDataHandler(ks))
				r.Post("/client-data/import", KuroImportClientDataHandler(ks))
				r.Get("/ws/chat", KuroChatWebSocketHandler(ks))

				// ─── ADMIN-ONLY SERVER INTEGRATIONS, ENGINE & SETTINGS ───
				r.Group(func(r chi.Router) {
					r.Use(auth.RequireAdmin)

					r.Get("/settings", KuroGetSettingsHandler(ks))
					r.Put("/settings", KuroUpdateSettingsHandler(ks))
					r.Post("/test-llm", KuroTestLLMHandler(ks))
					r.Get("/models", KuroListModelsHandler(ks))
					r.Post("/models/pull", KuroPullModelHandler(ks))
					r.Get("/models/pull/status", KuroGetPullStatusHandler(ks))
					r.Delete("/models/{name:.*}", KuroDeleteModelHandler(ks))
					r.Post("/models/active", KuroSetActiveModelHandler(ks))
					r.Get("/engine/status", KuroGetEngineStatusHandler(ks))
					r.Post("/engine/start", KuroStartEngineHandler(ks))
					r.Get("/integrations/baikal", KuroGetBaikalConfigHandler(ks))
					r.Post("/integrations/baikal/discover", KuroDiscoverBaikalHandler(ks))
					r.Put("/integrations/baikal", KuroSaveBaikalConfigHandler(ks))
					r.Get("/integrations/immich", KuroGetImmichConfigHandler(ks))
					r.Put("/integrations/immich", KuroSaveImmichConfigHandler(ks))
					r.Get("/evolution/status", KuroGetEvolutionStatusHandler(ks))
					r.Post("/evolution/trigger", KuroTriggerEvolutionHandler(ks))
				})
			})
		})

		// -----------------------------------------------------------------
		// Dashboard Protected Endpoints (Admin & Readonly roles)
		// -----------------------------------------------------------------
		r.Group(func(r chi.Router) {
			r.Use(auth.RequireDashboardUser)
			r.Use(auth.RequireReadOnlyOrAdmin)

			// Monitoring (Read-only for both Admin and Readonly roles)
			r.Get("/api/v1/status", StatusHandler(st))
			r.Get("/api/v1/memory", MemoryHandler(st))
			r.Get("/api/v1/storage", StorageHandler(st))
			r.Get("/api/v1/cpu", CPUHandler(st))
			r.Get("/api/v1/battery", BatteryHandler(st))
			r.Get("/api/v1/thermal", ThermalHandler(st))
			r.Get("/api/v1/network", NetworkHandler(st))
			r.Post("/api/v1/network/speedtest", NetworkSpeedTestHandler())
			r.Get("/api/v1/network/wifi/scan", NetworkWifiScanHandler())
			r.Post("/api/v1/network/wifi/connect", NetworkWifiConnectHandler())
			r.Post("/api/v1/network/wifi/disconnect", NetworkWifiDisconnectHandler())
			r.Get("/api/v1/docker", DockerHandler(st))
			r.Get("/api/v1/tailscale", TailscaleHandler(st))

			// Docker Projects
			r.Get("/api/v1/docker/projects", ListProjectsHandler(ds))
			r.Get("/api/v1/docker/projects/{project}", GetProjectHandler(ds))
			r.Post("/api/v1/docker/projects/{project}/start", StartProjectHandler(ds))
			r.Post("/api/v1/docker/projects/{project}/stop", StopProjectHandler(ds))
			r.Post("/api/v1/docker/projects/{project}/restart", RestartProjectHandler(ds))

			// Containers
			r.Get("/api/v1/docker/containers", ListContainersHandler(ds))
			r.Get("/api/v1/docker/containers/{id}", GetContainerHandler(ds))
			r.Get("/api/v1/docker/containers/{id}/logs", GetContainerLogsHandler(ds))
			r.Get("/api/v1/docker/containers/{id}/stats", GetContainerStatsHandler(ds))
			r.Post("/api/v1/docker/containers/{id}/start", StartContainerHandler(ds))
			r.Post("/api/v1/docker/containers/{id}/stop", StopContainerHandler(ds))
			r.Post("/api/v1/docker/containers/{id}/restart", RestartContainerHandler(ds))
			r.Delete("/api/v1/docker/containers/{id}", RemoveContainerHandler(ds))

			// File Manager
			r.Get("/api/v1/files", ListFilesHandler(fs))
			r.Get("/api/v1/file", ReadFileHandler(fs))
			r.Put("/api/v1/file", WriteFileHandler(fs))
			r.Post("/api/v1/upload", UploadFileHandler(fs))
			r.Post("/api/v1/mkdir", MkdirHandler(fs))
			r.Delete("/api/v1/file", DeleteFileHandler(fs))
			r.Post("/api/v1/rename", RenameFileHandler(fs))
			r.Post("/api/v1/move", MoveFileHandler(fs))
			r.Post("/api/v1/copy", CopyFileHandler(fs))
			r.Get("/api/v1/download", DownloadHandler(fs))
			r.Get("/api/v1/stat", StatFileHandler(fs))

			// Trash / Recycle Bin
			r.Get("/api/v1/trash", ListTrashHandler(fs))
			r.Post("/api/v1/trash/restore", RestoreTrashHandler(fs))
			r.Delete("/api/v1/trash/item", DeleteTrashItemHandler(fs))
			r.Delete("/api/v1/trash/empty", EmptyTrashHandler(fs))

			// Terminal
			r.Post("/api/v1/terminal/session", terminal.CreateSessionHandler(ts))
			r.Get("/api/v1/terminal/session", terminal.ListSessionsHandler(ts))
			r.Get("/api/v1/terminal/session/{id}", terminal.GetSessionHandler(ts))
			r.Delete("/api/v1/terminal/session/{id}", terminal.CloseSessionHandler(ts))
			r.Post("/api/v1/terminal/session/{id}/resize", terminal.ResizeSessionHandler(ts))
			r.Get("/ws/terminal/{id}", terminal.TerminalWebSocket(ts))

			// Users (Admin Only for management, Self for password change)
			r.Route("/api/v1/users", func(r chi.Router) {
				r.Get("/", ListUsersHandler(us))
				r.Post("/", CreateUserHandler(us))
				r.Get("/{id}", GetUserHandler(us))
				r.Put("/{id}", UpdateUserHandler(us))
				r.Delete("/{id}", DeleteUserHandler(us))
				r.Post("/{id}/password", ChangePasswordHandler(us))
				r.Post("/{id}/revoke-sessions", RevokeSessionsHandler(us))
				r.Get("/{id}/sessions", GetUserSessionsHandler(us, ks))
				r.Delete("/{id}/sessions/{session_id}", RevokeUserSessionHandler(us, ks))
				r.Delete("/{id}/sessions", RevokeAllUserSessionsHandler(us, ks))
				r.Post("/{id}/2fa/setup", AdminSetup2FAHandler(us))
				r.Post("/{id}/2fa/verify", AdminVerify2FAHandler(us))
				r.Post("/{id}/2fa/disable", AdminDisable2FAHandler(us))
			})

			// System Power Control (Admin Only)
			r.Group(func(r chi.Router) {
				r.Use(auth.RequireAdmin)
				r.Post("/api/v1/system/reboot", PowerRebootHandler(us, as))
			})

			// History
			r.Get("/api/v1/history/latest", history.LatestHandler(hs))
			r.Get("/api/v1/history", history.RangeHandler(hs))

			// User Preferences
			r.Get("/api/v1/preferences", GetPreferencesHandler(prefsStore))
			r.Put("/api/v1/preferences", PutPreferencesHandler(prefsStore))

			// Activities
			r.Get("/api/v1/activities", ListActivitiesHandler(st.Activities()))

			// Audit
			r.Route("/api/v1/audit", func(r chi.Router) {
				r.Get("/", ListAuditHandler(as))
				r.Get("/config", GetAuditConfigHandler())
				r.Get("/{id}", GetAuditHandler(as))
			})

			// Notifications
			r.Route("/api/v1/notifications", func(r chi.Router) {
				r.Get("/", ListNotificationsHandler(notifStore))
				r.Get("/summary", SummaryNotificationsHandler(notifStore))
				r.Post("/{id}/read", MarkNotificationReadHandler(notifStore))
				r.Post("/read-all", MarkAllNotificationsReadHandler(notifStore))
				r.Delete("/{id}", DeleteNotificationHandler(notifStore))
				r.Delete("/", ClearNotificationsHandler(notifStore))
				r.Post("/test", TestNotificationHandler(notifStore))
			})
		})

		// -----------------------------------------------------------------
		// Camera Hardware Streams (Admin, Readonly, and Kuro App User)
		// -----------------------------------------------------------------
		r.Group(func(r chi.Router) {
			r.Use(auth.RequireCameraAccess)

			r.Get("/api/v1/camera/devices", ListCameraDevicesHandler(cs))
			r.Get("/api/v1/camera/stream", CameraStreamHandler(cs))
			r.Get("/api/v1/camera/snapshot", CameraSnapshotHandler(cs))
			r.Get("/ws/camera/stream", CameraWSStreamHandler(cs))
		})
	})

	// ---------------------------------------------------------------------
	// React SPA
	// ---------------------------------------------------------------------

	spa := NewFrontendHandler()

	r.NotFound(func(w http.ResponseWriter, req *http.Request) {
		if strings.HasPrefix(req.URL.Path, "/api/") ||
			strings.HasPrefix(req.URL.Path, "/ws/") {
			http.NotFound(w, req)
			return
		}

		spa.ServeHTTP(w, req)
	})

	return r
}
