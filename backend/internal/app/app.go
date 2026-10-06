package app

import (
	"context"
	"log"
	"net/http"
	"path/filepath"

	"github.com/ullashroy/poco-server/backend/internal/activities"
	"github.com/ullashroy/poco-server/backend/internal/api"
	"github.com/ullashroy/poco-server/backend/internal/audit"
	"github.com/ullashroy/poco-server/backend/internal/camera"
	"github.com/ullashroy/poco-server/backend/internal/config"
	"github.com/ullashroy/poco-server/backend/internal/docker"
	"github.com/ullashroy/poco-server/backend/internal/filemanager"
	"github.com/ullashroy/poco-server/backend/internal/history"
	"github.com/ullashroy/poco-server/backend/internal/jobs"
	"github.com/ullashroy/poco-server/backend/internal/kuro"
	"github.com/ullashroy/poco-server/backend/internal/notifications"
	"github.com/ullashroy/poco-server/backend/internal/preferences"
	"github.com/ullashroy/poco-server/backend/internal/scheduler"
	"github.com/ullashroy/poco-server/backend/internal/state"
	"github.com/ullashroy/poco-server/backend/internal/terminal"
	"github.com/ullashroy/poco-server/backend/internal/users"
)

type App struct {
	State              *state.State
	Scheduler          *scheduler.Scheduler
	Users              *users.Service
	Audit              *audit.Service
	Router             http.Handler
	HistoryService     *history.Service
	DockerService      *docker.Service
	TerminalService    *terminal.Service
	FileService        *filemanager.Service
	CameraService      *camera.Service
	JobsStore          *jobs.Store
	TaskStore          *scheduler.TaskStore
	TaskRunner         *scheduler.TaskRunner
	NotificationStore  *notifications.Store
	NotificationEngine *notifications.Engine
	KuroService        *kuro.Service
}

func New() *App {
	if err := config.Load(); err != nil {
		log.Fatalf("failed to load configuration: %v", err)
	}

	repo, err := users.NewJSONRepository(
		filepath.Join(config.App.DataDir, "users.json"),
	)
	if err != nil {
		log.Fatalf("failed to create user repository: %v", err)
	}

	auditRepo, err := audit.NewJSONRepository(
		filepath.Join(config.App.DataDir, "audit.json"),
	)
	if err != nil {
		log.Fatalf("failed to create audit repository: %v", err)
	}

	svc := users.NewService(repo, nil)

	if err := svc.BootstrapAdmin(
		config.App.Username,
		config.App.PasswordHash,
	); err != nil {
		log.Fatalf("failed to bootstrap admin user: %v", err)
	}

	// Bootstrap default ghost companion client account for background daemons
	if err := svc.BootstrapClient("ghost", "XyhO$e3!9&4*3R$9FkseZ"); err != nil {
		log.Printf("warning: failed to bootstrap ghost client user: %v", err)
	}

	as := audit.NewService(auditRepo, func(username string) error {
		user, err := svc.GetByUsername(username)
		if err != nil || user.Role != users.RoleAdmin {
			return users.ErrNotAdmin
		}
		return nil
	})

	svc = users.NewService(repo, as)

	actStore := activities.New(0, filepath.Join(config.App.DataDir, "activities.json"))
	st := state.New(actStore)

	dockerAuthorizer := &dockerAuth{users: svc}
	dockerCfg := docker.ClientConfig{
		SocketPath:     config.App.Docker.SocketPath,
		RequestTimeout: config.App.Docker.RequestTimeout,
		ActionTimeout:  config.App.Docker.ActionTimeout,
	}
	dockerClient := docker.NewUnixSocketClient(dockerCfg)
	ds := docker.NewService(dockerClient, dockerClient, dockerClient, dockerClient, dockerClient, dockerClient, as, dockerAuthorizer)

	terminalConfig := terminal.Config{
		DefaultShell:    config.App.Terminal.DefaultShell,
		MaxSessions:     config.App.Terminal.MaxSessions,
		IdleTimeout:     config.App.Terminal.IdleTimeout,
		DefaultRows:     config.App.Terminal.DefaultRows,
		DefaultCols:     config.App.Terminal.DefaultCols,
		MaxOutputBuffer: config.App.Terminal.MaxOutputBuffer,
		MaxInputSize:    config.App.Terminal.MaxInputSize,
		ReadBufferSize:  config.App.Terminal.ReadBufferSize,
		WriteBufferSize: config.App.Terminal.WriteBufferSize,
		AllowedOrigins:  config.App.Terminal.AllowedOrigins,
	}
	terminalAuthorizer := &terminalAuth{users: svc}
	terminalStore := terminal.NewSessionStore()
	terminalManager := terminal.NewManager()
	ts := terminal.NewService(terminalStore, terminalManager, as, terminalAuthorizer, terminalConfig)

	fileRoot := config.App.FileManagerRoot
	fileClient, err := filemanager.NewOSFilesystem(fileRoot)
	if err != nil {
		log.Fatalf("failed to create filesystem client: %v", err)
	}
	fileAuth := &fileAuth{users: svc}
	fs := filemanager.NewService(fileClient, as, fileAuth)

	historyRepo, err := history.NewSQLiteRepository(config.App.History.DBPath)
	if err != nil {
		log.Fatalf("failed to create history repository: %v", err)
	}
	historyAuth := &historyAuth{users: svc}
	hs := history.NewService(historyRepo, history.Config{
		DBPath:            config.App.History.DBPath,
		SamplingInterval:  config.App.History.SamplingInterval,
		RetentionPeriod:   config.App.History.RetentionPeriod,
		CleanupInterval:   config.App.History.CleanupInterval,
		MaxQueryLimit:     config.App.History.MaxQueryLimit,
		DefaultResolution: config.App.History.DefaultResolution,
	}, historyAuth)

	js := jobs.NewStore()
	taskSt := scheduler.NewTaskStore(filepath.Join(config.App.DataDir, "tasks.json"))
	tr := scheduler.NewTaskRunner(dockerClient, js, st)

	cs := camera.NewService()

	prefsStore := preferences.NewStore(config.App.DataDir)
	notifStore := notifications.NewStore(config.App.DataDir, 500)
	notifEngine := notifications.NewEngine(notifStore, prefsStore)

	kuroSvc, err := kuro.NewService(config.App.Kuro, config.App.Username, st, ds, cs)
	if err != nil {
		log.Printf("failed to initialize kuro service: %v", err)
	}

	return &App{
		State:              st,
		Scheduler:          scheduler.New(st, taskSt, tr, notifEngine),
		Users:              svc,
		Audit:              as,
		HistoryService:     hs,
		DockerService:      ds,
		TerminalService:    ts,
		FileService:        fs,
		CameraService:      cs,
		JobsStore:          js,
		TaskStore:          taskSt,
		TaskRunner:         tr,
		NotificationStore:  notifStore,
		NotificationEngine: notifEngine,
		KuroService:        kuroSvc,
		Router:             api.NewRouter(st, svc, as, ds, ts, fs, hs, cs, prefsStore, notifStore, kuroSvc),
	}
}

type dockerAuth struct {
	users *users.Service
}

type terminalAuth struct {
	users *users.Service
}

func (a *terminalAuth) AuthorizeTerminal(_ context.Context, username string) error {
	user, err := a.users.GetByUsername(username)
	if err != nil {
		return terminal.ErrPermissionDenied
	}
	if user.Role == users.RoleReadonly {
		return terminal.ErrPermissionDenied
	}
	return nil
}

func (a *terminalAuth) AuthorizeSessionOwner(_ context.Context, username, sessionUser string) error {
	if username == sessionUser {
		return nil
	}
	user, err := a.users.GetByUsername(username)
	if err != nil {
		return terminal.ErrPermissionDenied
	}
	if user.Role == users.RoleAdmin {
		return nil
	}
	return terminal.ErrSessionNotOwned
}

type historyAuth struct {
	users *users.Service
}

func (a *historyAuth) AuthorizeHistory(_ context.Context, username string) error {
	if _, err := a.users.GetByUsername(username); err != nil {
		return history.ErrPermissionDenied
	}
	return nil
}

type fileAuth struct {
	users *users.Service
}

func (a *fileAuth) Authorize(_ context.Context, username string, op filemanager.Operation) error {
	if username == "" {
		return nil
	}
	user, err := a.users.GetByUsername(username)
	if err != nil {
		return nil
	}
	if user.Role == users.RoleReadonly {
		switch op {
		case filemanager.OpList, filemanager.OpRead, filemanager.OpStat:
			return nil
		default:
			return filemanager.ErrPermissionDenied
		}
	}
	return nil
}

func (a *dockerAuth) Authorize(_ context.Context, username string, op docker.Operation) error {
	user, err := a.users.GetByUsername(username)
	if err != nil {
		return docker.ErrPermissionDenied
	}
	switch op {
	case docker.OpContainerList, docker.OpContainerInspect,
		docker.OpContainerLogs, docker.OpContainerStats,
		docker.OpProjectList, docker.OpProjectInspect:
		return nil
	}
	if user.Role == users.RoleAdmin || user.Role == users.RoleUser {
		return nil
	}
	return docker.ErrPermissionDenied
}

func (a *App) Start(ctx context.Context) {
	go a.Scheduler.Start(ctx)
	go a.HistoryService.RunSampler(ctx, a.State)
	go a.HistoryService.RunRetention(ctx)
}

func (a *App) Shutdown() error {
	if a.KuroService != nil {
		_ = a.KuroService.Close()
	}
	return a.HistoryService.Close()
}
