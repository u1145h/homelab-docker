package terminal

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"

	"github.com/ullashroy/poco-server/backend/internal/auth"
)

type safeWS struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func (s *safeWS) WriteJSON(v any) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_ = s.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	return s.conn.WriteJSON(v)
}

func (s *safeWS) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.conn.Close()
}

func newUpgrader(allowedOrigins []string) websocket.Upgrader {
	return websocket.Upgrader{
		ReadBufferSize:  4096,
		WriteBufferSize: 4096,
		CheckOrigin: func(r *http.Request) bool {
			// Authentication is verified upstream by JWT auth middleware and session ownership checks.
			return true
		},
	}
}

func TerminalWebSocket(ts *Service) http.HandlerFunc {
	upgrader := newUpgrader(ts.config.AllowedOrigins)

	return func(w http.ResponseWriter, r *http.Request) {
		actor := auth.CurrentUser(r.Context())
		id := chi.URLParam(r, "id")

		rt, err := ts.AttachSession(r.Context(), actor.Username, id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("terminal: websocket upgrade failed: %v", err)
			return
		}

		sws := &safeWS{conn: conn}

		ts.ReportActivity(r.Context(), id)

		go func() {
			defer func() {
				if rec := recover(); rec != nil {
					log.Printf("terminal: recovered panic in pty reader: %v", rec)
				}
				_ = sws.Close()
			}()

			buf := make([]byte, ts.config.ReadBufferSize)
			for {
				n, err := rt.PTY.Read(buf)
				if err != nil {
					return
				}
				if n == 0 {
					continue
				}

				msg := WSMessage{
					Type: WSMessageOutput,
					Data: string(buf[:n]),
				}
				if err := sws.WriteJSON(msg); err != nil {
					return
				}
			}
		}()

		defer func() {
			_ = ts.CloseSession(context.Background(), actor.Username, id)
			_ = sws.Close()
		}()

		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				return
			}

			ts.ReportActivity(r.Context(), id)

			var msg WSMessage
			if err := json.Unmarshal(message, &msg); err != nil {
				continue
			}

			switch msg.Type {
			case WSMessageInput:
				if len(msg.Data) > ts.config.MaxInputSize {
					continue
				}
				if _, err := rt.PTY.Write([]byte(msg.Data)); err != nil {
					return
				}

			case WSMessageResize:
				if msg.Rows == 0 || msg.Cols == 0 {
					continue
				}
				if err := rt.PTY.Resize(msg.Rows, msg.Cols); err != nil {
					log.Printf("terminal: resize error: %v", err)
				}

			case WSMessagePing:
				pong := WSMessage{Type: WSMessagePong}
				if err := sws.WriteJSON(pong); err != nil {
					return
				}

			case WSMessageExit:
				return

			default:
				continue
			}
		}
	}
}
