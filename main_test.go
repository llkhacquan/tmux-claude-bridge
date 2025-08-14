package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestLoadConfig(t *testing.T) {
	// Clear environment variables that might affect the test
	originalTmuxPane := os.Getenv("TMUX_PANE")
	os.Unsetenv("TMUX_PANE")
	defer func() {
		if originalTmuxPane != "" {
			os.Setenv("TMUX_PANE", originalTmuxPane)
		}
	}()
	
	// Test default configuration
	config := loadConfig()
	
	if config.Port != "8080" {
		t.Errorf("Expected default port '8080', got '%s'", config.Port)
	}
	
	if config.TmuxSession != "claude-bridge" {
		t.Errorf("Expected default session 'claude-bridge', got '%s'", config.TmuxSession)
	}
	
	if config.TmuxPane != "1" {
		t.Errorf("Expected default pane '1', got '%s'", config.TmuxPane)
	}
	
	if config.LogLevel != "info" {
		t.Errorf("Expected default log level 'info', got '%s'", config.LogLevel)
	}
}

func TestNewTmuxBridge(t *testing.T) {
	config := Config{
		Port:        "8080",
		TmuxSession: "test-session",
		TmuxPane:    "1",
		LogLevel:    "info",
	}
	
	bridge := NewTmuxBridge(config)
	
	if bridge == nil {
		t.Fatal("Expected bridge to be created, got nil")
	}
	
	if bridge.config.TmuxSession != "test-session" {
		t.Errorf("Expected session 'test-session', got '%s'", bridge.config.TmuxSession)
	}
	
	if bridge.clients == nil {
		t.Error("Expected clients map to be initialized")
	}
	
	if bridge.logger == nil {
		t.Error("Expected logger to be initialized")
	}
}

func TestHealthCheckHandler(t *testing.T) {
	config := Config{
		Port:        "8080",
		TmuxSession: "test-session", 
		TmuxPane:    "1",
		LogLevel:    "info",
	}
	
	bridge := NewTmuxBridge(config)
	
	req, err := http.NewRequest("GET", "/health", nil)
	if err != nil {
		t.Fatal(err)
	}
	
	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(bridge.healthCheck)
	handler.ServeHTTP(rr, req)
	
	// Since tmux session doesn't exist in test environment, expect 503
	if status := rr.Code; status != http.StatusServiceUnavailable {
		t.Errorf("Expected status code %d, got %d", http.StatusServiceUnavailable, status)
	}
	
	// Check content type
	expected := "text/plain; charset=utf-8"
	if ct := rr.Header().Get("Content-Type"); ct != expected {
		t.Errorf("Expected content type '%s', got '%s'", expected, ct)
	}
}

func TestMessageValidation(t *testing.T) {
	tests := []struct {
		name    string
		message Message
		valid   bool
	}{
		{
			name: "valid execute message",
			message: Message{
				Type:    "execute",
				Command: "ls -la",
				ID:      "test-id",
			},
			valid: true,
		},
		{
			name: "valid ping message",
			message: Message{
				Type: "ping",
				ID:   "ping-id",
			},
			valid: true,
		},
		{
			name: "valid output message",
			message: Message{
				Type:   "output",
				Output: "command output",
				Status: "complete",
				ID:     "output-id",
			},
			valid: true,
		},
		{
			name: "invalid message without type",
			message: Message{
				Command: "ls",
				ID:      "no-type",
			},
			valid: false,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test JSON marshaling/unmarshaling
			data, err := json.Marshal(tt.message)
			if err != nil {
				t.Fatalf("Failed to marshal message: %v", err)
			}
			
			var decoded Message
			err = json.Unmarshal(data, &decoded)
			if err != nil {
				t.Fatalf("Failed to unmarshal message: %v", err)
			}
			
			// Basic validation
			if tt.valid && decoded.Type == "" {
				t.Error("Expected valid message to have type")
			}
		})
	}
}

func TestCleanOutput(t *testing.T) {
	config := Config{
		Port:        "8080",
		TmuxSession: "test-session",
		TmuxPane:    "1", 
		LogLevel:    "info",
	}
	
	bridge := NewTmuxBridge(config)
	
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "remove ANSI escape sequences",
			input:    "\x1b[31mred text\x1b[0m",
			expected: "red text",
		},
		{
			name:     "remove carriage returns",
			input:    "line1\r\nline2\r",
			expected: "line1\nline2",
		},
		{
			name:     "trim trailing whitespace",
			input:    "text with spaces   \t\n",
			expected: "text with spaces\n",
		},
		{
			name:     "preserve structure",
			input:    "line1\n\nline3",
			expected: "line1\n\nline3",
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := bridge.cleanOutput(tt.input)
			if result != tt.expected {
				t.Errorf("Expected '%s', got '%s'", tt.expected, result)
			}
		})
	}
}

func TestIsCommandComplete(t *testing.T) {
	config := Config{
		Port:        "8080",
		TmuxSession: "test-session",
		TmuxPane:    "1",
		LogLevel:    "info",
	}
	
	bridge := NewTmuxBridge(config)
	
	tests := []struct {
		name     string
		output   string
		complete bool
	}{
		{
			name:     "bash prompt",
			output:   "user@host:~/project$ ",
			complete: true,
		},
		{
			name:     "root prompt",
			output:   "root@host:/# ",
			complete: true,
		},
		{
			name:     "zsh prompt",
			output:   "user@host project % ",
			complete: true,
		},
		{
			name:     "incomplete output",
			output:   "running command...",
			complete: false,
		},
		{
			name:     "empty output",
			output:   "",
			complete: false,
		},
		{
			name:     "multiline with prompt",
			output:   "line1\nline2\nuser@host:~$ ",
			complete: true,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := bridge.isCommandComplete(tt.output)
			if result != tt.complete {
				t.Errorf("Expected %v, got %v for output: %s", tt.complete, result, tt.output)
			}
		})
	}
}

func TestWebSocketUpgrade(t *testing.T) {
	config := Config{
		Port:        "8080",
		TmuxSession: "test-session",
		TmuxPane:    "1",
		LogLevel:    "info",
	}
	
	bridge := NewTmuxBridge(config)
	
	// Create test server
	server := httptest.NewServer(http.HandlerFunc(bridge.handleWebSocket))
	defer server.Close()
	
	// Convert http:// to ws://
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	
	// Test WebSocket connection
	dialer := websocket.Dialer{
		HandshakeTimeout: 5 * time.Second,
	}
	
	conn, _, err := dialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect to WebSocket: %v", err)
	}
	defer conn.Close()
	
	// Read welcome message first
	var welcomeMsg Message
	err = conn.ReadJSON(&welcomeMsg)
	if err != nil {
		t.Fatalf("Failed to read welcome message: %v", err)
	}
	
	if welcomeMsg.Type != "status" {
		t.Errorf("Expected welcome message type 'status', got '%s'", welcomeMsg.Type)
	}
	
	// Test ping message
	pingMsg := Message{
		Type: "ping",
		ID:   "test-ping",
	}
	
	err = conn.WriteJSON(pingMsg)
	if err != nil {
		t.Fatalf("Failed to send ping message: %v", err)
	}
	
	// Read pong response
	var pongResponse Message
	err = conn.ReadJSON(&pongResponse)
	if err != nil {
		t.Fatalf("Failed to read pong response: %v", err)
	}
	
	// Verify pong response
	if pongResponse.Type != "pong" {
		t.Errorf("Expected 'pong', got '%s'", pongResponse.Type)
	}
	
	if pongResponse.ID != "test-ping" {
		t.Errorf("Expected ID 'test-ping', got '%s'", pongResponse.ID)
	}
}

func TestClientManagement(t *testing.T) {
	config := Config{
		Port:        "8080",
		TmuxSession: "test-session",
		TmuxPane:    "1",
		LogLevel:    "info",
	}
	
	bridge := NewTmuxBridge(config)
	
	// Create mock WebSocket connection
	server := httptest.NewServer(http.HandlerFunc(bridge.handleWebSocket))
	defer server.Close()
	
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	
	// Connect first client
	conn1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect first client: %v", err)
	}
	defer conn1.Close()
	
	// Small delay to ensure connection is registered
	time.Sleep(100 * time.Millisecond)
	
	// Check client count
	bridge.clientsMu.RLock()
	clientCount := len(bridge.clients)
	bridge.clientsMu.RUnlock()
	
	if clientCount != 1 {
		t.Errorf("Expected 1 client, got %d", clientCount)
	}
	
	// Connect second client
	conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect second client: %v", err)
	}
	defer conn2.Close()
	
	time.Sleep(100 * time.Millisecond)
	
	// Check client count again
	bridge.clientsMu.RLock()
	clientCount = len(bridge.clients)
	bridge.clientsMu.RUnlock()
	
	if clientCount != 2 {
		t.Errorf("Expected 2 clients, got %d", clientCount)
	}
}

func TestBroadcastMessage(t *testing.T) {
	config := Config{
		Port:        "8080", 
		TmuxSession: "test-session",
		TmuxPane:    "1",
		LogLevel:    "info",
	}
	
	bridge := NewTmuxBridge(config)
	
	// Test broadcast with no clients - should not panic
	testMsg := Message{
		Type:   "test",
		Output: "broadcast test",
		ID:     "broadcast-test",
	}
	
	// This should not panic with no clients
	bridge.broadcast(testMsg)
	
	// Test with mock connections
	// Create mock connections by manually adding to the clients map
	bridge.clientsMu.Lock()
	// Note: We can't easily test real WebSocket connections concurrently
	// without complex setup, so we just test the data structure safety
	if len(bridge.clients) != 0 {
		t.Errorf("Expected 0 clients, got %d", len(bridge.clients))
	}
	bridge.clientsMu.Unlock()
}

// Benchmark tests for performance
func BenchmarkCleanOutput(b *testing.B) {
	config := Config{
		Port:        "8080",
		TmuxSession: "test-session", 
		TmuxPane:    "1",
		LogLevel:    "info",
	}
	
	bridge := NewTmuxBridge(config)
	
	input := "\x1b[31mThis is some \x1b[32mcolored\x1b[0m text with\r\nmultiple\nlines\r\n"
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		bridge.cleanOutput(input)
	}
}

func BenchmarkIsCommandComplete(b *testing.B) {
	config := Config{
		Port:        "8080",
		TmuxSession: "test-session",
		TmuxPane:    "1",
		LogLevel:    "info",
	}
	
	bridge := NewTmuxBridge(config)
	
	output := "line1\nline2\nline3\nuser@host:~/project$ "
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		bridge.isCommandComplete(output)
	}
}