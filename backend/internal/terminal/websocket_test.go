package terminal

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
)

func setupWebSocketTest(t *testing.T) (*chi.Mux, *Service, string) {
	t.Helper()

	pty := &mockPTY{pid: 42, data: "hello world"}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	session, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	r := chi.NewRouter()
	r.Get("/terminal/ws/{id}", TerminalWebSocket(svc))

	server := httptest.NewServer(r)
	t.Cleanup(server.Close)

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/terminal/ws/" + session.ID

	return r, svc, wsURL
}

func dialWS(t *testing.T, wsURL string) *websocket.Conn {
	t.Helper()
	dialer := websocket.Dialer{}
	conn, _, err := dialer.Dial(wsURL, http.Header{})
	if err != nil {
		t.Fatalf("failed to dial WebSocket: %v", err)
	}
	return conn
}

func TestWebSocket_Upgrade(t *testing.T) {
	_, _, wsURL := setupWebSocketTest(t)
	conn := dialWS(t, wsURL)
	conn.Close()
}

func TestWebSocket_Output(t *testing.T) {
	_, _, wsURL := setupWebSocketTest(t)
	conn := dialWS(t, wsURL)
	defer conn.Close()

	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("failed to read output: %v", err)
	}

	var wsMsg WSMessage
	if err := json.Unmarshal(msg, &wsMsg); err != nil {
		t.Fatalf("failed to unmarshal message: %v", err)
	}
	if wsMsg.Type != WSMessageOutput {
		t.Errorf("expected type %q, got %q", WSMessageOutput, wsMsg.Type)
	}
	if wsMsg.Data != "hello world" {
		t.Errorf("expected data %q, got %q", "hello world", wsMsg.Data)
	}
}

func TestWebSocket_Input(t *testing.T) {
	pty := &mockPTY{pid: 43}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	session, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	r := chi.NewRouter()
	r.Get("/terminal/ws/{id}", TerminalWebSocket(svc))

	server := httptest.NewServer(r)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/terminal/ws/" + session.ID
	conn := dialWS(t, wsURL)
	defer conn.Close()

	inputMsg := WSMessage{Type: WSMessageInput, Data: "ls -la"}
	data, _ := json.Marshal(inputMsg)
	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		t.Fatalf("failed to write input: %v", err)
	}
}

func TestWebSocket_Resize(t *testing.T) {
	pty := &mockPTY{pid: 44}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	session, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	r := chi.NewRouter()
	r.Get("/terminal/ws/{id}", TerminalWebSocket(svc))

	server := httptest.NewServer(r)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/terminal/ws/" + session.ID
	conn := dialWS(t, wsURL)
	defer conn.Close()

	resizeMsg := WSMessage{Type: WSMessageResize, Rows: 40, Cols: 120}
	data, _ := json.Marshal(resizeMsg)
	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		t.Fatalf("failed to write resize: %v", err)
	}
}

func TestWebSocket_PingPong(t *testing.T) {
	pty := &mockPTY{pid: 45}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	session, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	r := chi.NewRouter()
	r.Get("/terminal/ws/{id}", TerminalWebSocket(svc))

	server := httptest.NewServer(r)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/terminal/ws/" + session.ID
	conn := dialWS(t, wsURL)
	defer conn.Close()

	pingMsg := WSMessage{Type: WSMessagePing}
	data, _ := json.Marshal(pingMsg)
	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		t.Fatalf("failed to write ping: %v", err)
	}

	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("failed to read pong: %v", err)
	}

	var wsMsg WSMessage
	if err := json.Unmarshal(msg, &wsMsg); err != nil {
		t.Fatalf("failed to unmarshal message: %v", err)
	}
	if wsMsg.Type != WSMessagePong {
		t.Errorf("expected type %q, got %q", WSMessagePong, wsMsg.Type)
	}
}

func TestWebSocket_Exit(t *testing.T) {
	pty := &mockPTY{pid: 46}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	session, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	r := chi.NewRouter()
	r.Get("/terminal/ws/{id}", TerminalWebSocket(svc))

	server := httptest.NewServer(r)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/terminal/ws/" + session.ID
	conn := dialWS(t, wsURL)
	defer conn.Close()

	exitMsg := WSMessage{Type: WSMessageExit}
	data, _ := json.Marshal(exitMsg)
	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		t.Fatalf("failed to write exit: %v", err)
	}

	// Wait for close to propagate
	time.Sleep(50 * time.Millisecond)

	// Session should be closed by the exit
	meta, err := store.Get(context.Background(), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if meta.ClosedAt == nil {
		t.Error("expected session to be closed after exit")
	}
}

func TestWebSocket_UnauthorizedAttach(t *testing.T) {
	pty := &mockPTY{pid: 47}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	session, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	authz.ownerErr = ErrSessionNotOwned

	r := chi.NewRouter()
	r.Get("/terminal/ws/{id}", TerminalWebSocket(svc))

	server := httptest.NewServer(r)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/terminal/ws/" + session.ID
	dialer := websocket.Dialer{}

	conn, resp, err := dialer.Dial(wsURL, http.Header{})
	if err == nil {
		conn.Close()
		t.Fatal("expected dial error for unauthorized attach")
	}
	if resp != nil && resp.StatusCode != http.StatusForbidden {
		t.Errorf("expected HTTP 403, got %d", resp.StatusCode)
	}
}

func TestWebSocket_LargeInputRejected(t *testing.T) {
	pty := &mockPTY{pid: 48}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	cfg := defaultConfig()
	cfg.MaxInputSize = 10
	svc := NewService(store, &mockManager{pty: pty}, nil, authz, cfg)

	session, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	r := chi.NewRouter()
	r.Get("/terminal/ws/{id}", TerminalWebSocket(svc))

	server := httptest.NewServer(r)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/terminal/ws/" + session.ID
	conn := dialWS(t, wsURL)
	defer conn.Close()

	// Send input larger than MaxInputSize (10)
	inputMsg := WSMessage{Type: WSMessageInput, Data: "this is way too long for max input"}
	data, _ := json.Marshal(inputMsg)
	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		t.Fatalf("failed to write input: %v", err)
	}

	// PTY.Write should not have been called, session stays open
	meta, err := store.Get(context.Background(), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if meta.ClosedAt != nil {
		t.Error("session should remain open after large input, not be closed")
	}
}

func TestWebSocket_InvalidJSONIgnored(t *testing.T) {
	pty := &mockPTY{pid: 49}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	session, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	r := chi.NewRouter()
	r.Get("/terminal/ws/{id}", TerminalWebSocket(svc))

	server := httptest.NewServer(r)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/terminal/ws/" + session.ID
	conn := dialWS(t, wsURL)
	defer conn.Close()

	// Send invalid JSON - should be ignored
	if err := conn.WriteMessage(websocket.TextMessage, []byte("{not valid json")); err != nil {
		t.Fatalf("failed to write invalid message: %v", err)
	}

	// Session should still be open
	meta, err := store.Get(context.Background(), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if meta.ClosedAt != nil {
		t.Error("session should remain open after invalid JSON")
	}
}

func TestWebSocket_UnknownTypeIgnored(t *testing.T) {
	pty := &mockPTY{pid: 50}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	session, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	r := chi.NewRouter()
	r.Get("/terminal/ws/{id}", TerminalWebSocket(svc))

	server := httptest.NewServer(r)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/terminal/ws/" + session.ID
	conn := dialWS(t, wsURL)
	defer conn.Close()

	// Send message with unknown type - should be ignored
	unknownMsg := WSMessage{Type: "unknown", Data: "test"}
	data, _ := json.Marshal(unknownMsg)
	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		t.Fatalf("failed to write unknown message: %v", err)
	}

	// Session should still be open
	meta, err := store.Get(context.Background(), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if meta.ClosedAt != nil {
		t.Error("session should remain open after unknown message type")
	}
}

func TestWebSocket_CleanupOnDisconnect(t *testing.T) {
	pty := &mockPTY{pid: 51, data: "test output"}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	session, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	r := chi.NewRouter()
	r.Get("/terminal/ws/{id}", TerminalWebSocket(svc))

	server := httptest.NewServer(r)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/terminal/ws/" + session.ID
	conn := dialWS(t, wsURL)

	// Close the client connection
	conn.Close()

	// Wait for handler defer to run
	time.Sleep(100 * time.Millisecond)

	// Session should be closed by the handler defer
	meta, err := store.Get(context.Background(), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if meta.ClosedAt == nil {
		t.Error("expected session to be closed after WebSocket disconnect")
	}
}

func TestWebSocket_ExternalSessionClose(t *testing.T) {
	pty := &mockPTY{pid: 52, data: "ongoing output"}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	session, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	r := chi.NewRouter()
	r.Get("/terminal/ws/{id}", TerminalWebSocket(svc))

	server := httptest.NewServer(r)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/terminal/ws/" + session.ID
	conn := dialWS(t, wsURL)
	defer conn.Close()

	// Close the session externally (as if admin closed it)
	if err := svc.CloseSession(context.Background(), "alice", session.ID); err != nil {
		t.Fatal(err)
	}

	// The mockPTY now returns ErrPTYClosed on Read after Close,
	// which should cause the output goroutine to terminate cleanly.
	// This test verifies no hang or panic.
	time.Sleep(50 * time.Millisecond)

	// Session should be closed
	meta, err := store.Get(context.Background(), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if meta.ClosedAt == nil {
		t.Error("expected session to be closed")
	}
}

func TestWebSocket_ResizeZeroSizeIgnored(t *testing.T) {
	pty := &mockPTY{pid: 53}
	store := &mockStore{sessions: make(map[string]*SessionMetadata)}
	authz := &mockAuthorizer{}
	svc := newTestService(store, &mockManager{pty: pty}, authz)

	session, err := svc.CreateSession(context.Background(), "alice", CreateSessionRequest{
		Shell: defaultShell(),
		Rows:  24,
		Cols:  80,
	})
	if err != nil {
		t.Fatal(err)
	}

	r := chi.NewRouter()
	r.Get("/terminal/ws/{id}", TerminalWebSocket(svc))

	server := httptest.NewServer(r)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/terminal/ws/" + session.ID
	conn := dialWS(t, wsURL)
	defer conn.Close()

	// Send resize with zero size - should be ignored
	resizeMsg := WSMessage{Type: WSMessageResize, Rows: 0, Cols: 0}
	data, _ := json.Marshal(resizeMsg)
	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		t.Fatalf("failed to write resize: %v", err)
	}

	// Session should still be open
	meta, err := store.Get(context.Background(), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if meta.ClosedAt != nil {
		t.Error("session should remain open after zero-size resize")
	}
}
