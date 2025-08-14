package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

type Config struct {
	Port        string `json:"port"`
	TmuxSession string `json:"tmux_session"`
	TmuxPane    string `json:"tmux_pane"`
	LogLevel    string `json:"log_level"`
}

type Message struct {
	Type    string `json:"type"`
	Command string `json:"command,omitempty"`
	Output  string `json:"output,omitempty"`
	Error   string `json:"error,omitempty"`
	Status  string `json:"status,omitempty"`
	ID      string `json:"id,omitempty"`
}

type TmuxBridge struct {
	config    Config
	logger    *logrus.Logger
	upgrader  websocket.Upgrader
	clients   map[*websocket.Conn]bool
	clientsMu sync.RWMutex
}

func NewTmuxBridge(config Config) *TmuxBridge {
	logger := logrus.New()
	level, err := logrus.ParseLevel(config.LogLevel)
	if err != nil {
		level = logrus.InfoLevel
	}
	logger.SetLevel(level)

	return &TmuxBridge{
		config:   config,
		logger:   logger,
		clients:  make(map[*websocket.Conn]bool),
		upgrader: websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }},
	}
}

func (tb *TmuxBridge) addClient(conn *websocket.Conn) {
	tb.clientsMu.Lock()
	defer tb.clientsMu.Unlock()
	tb.clients[conn] = true
}

func (tb *TmuxBridge) removeClient(conn *websocket.Conn) {
	tb.clientsMu.Lock()
	defer tb.clientsMu.Unlock()
	delete(tb.clients, conn)
}

func (tb *TmuxBridge) broadcast(msg Message) {
	tb.clientsMu.RLock()
	defer tb.clientsMu.RUnlock()

	for conn := range tb.clients {
		if err := conn.WriteJSON(msg); err != nil {
			tb.logger.WithError(err).Error("Failed to send message to client")
			conn.Close()
			delete(tb.clients, conn)
		}
	}
}

func (tb *TmuxBridge) checkTmuxSession() error {
	cmd := exec.Command("tmux", "has-session", "-t", tb.config.TmuxSession)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("tmux session '%s' not found", tb.config.TmuxSession)
	}
	return nil
}

func (tb *TmuxBridge) executeCommand(command string, id string) {
	tb.logger.WithFields(logrus.Fields{
		"command": command,
		"id":      id,
	}).Info("Executing command")

	target := fmt.Sprintf("%s:%s", tb.config.TmuxSession, tb.config.TmuxPane)

	// Clear the pane first
	clearCmd := exec.Command("tmux", "send-keys", "-t", target, "C-c", "C-l")
	clearCmd.Run()

	time.Sleep(100 * time.Millisecond)

	// Send the command
	cmd := exec.Command("tmux", "send-keys", "-t", target, command, "Enter")
	if err := cmd.Run(); err != nil {
		tb.broadcast(Message{
			Type:  "error",
			Error: fmt.Sprintf("Failed to execute command: %v", err),
			ID:    id,
		})
		return
	}

	// Capture output with timeout
	go tb.captureOutput(id, 30*time.Second)
}

func (tb *TmuxBridge) captureOutput(id string, timeout time.Duration) {
	target := fmt.Sprintf("%s:%s", tb.config.TmuxSession, tb.config.TmuxPane)

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	var output strings.Builder
	lastOutput := ""
	stableCount := 0

	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			tb.broadcast(Message{
				Type:   "output",
				Output: output.String(),
				Status: "timeout",
				ID:     id,
			})
			return
		case <-ticker.C:
			cmd := exec.Command("tmux", "capture-pane", "-t", target, "-p")
			out, err := cmd.Output()
			if err != nil {
				tb.logger.WithError(err).Error("Failed to capture pane")
				continue
			}

			currentOutput := string(out)
			currentOutput = tb.cleanOutput(currentOutput)

			if currentOutput == lastOutput {
				stableCount++
				if stableCount >= 5 { // Output stable for 1 second (5 * 200ms)
					if tb.isCommandComplete(currentOutput) {
						tb.broadcast(Message{
							Type:   "output",
							Output: currentOutput,
							Status: "complete",
							ID:     id,
						})
						return
					}
				}
			} else {
				stableCount = 0
				lastOutput = currentOutput
				output.Reset()
				output.WriteString(currentOutput)

				// Send intermediate output
				tb.broadcast(Message{
					Type:   "output",
					Output: currentOutput,
					Status: "running",
					ID:     id,
				})
			}
		}
	}
}

func (tb *TmuxBridge) cleanOutput(output string) string {
	lines := strings.Split(output, "\n")
	var cleanLines []string

	for _, line := range lines {
		// Remove ANSI escape sequences
		re := regexp.MustCompile(`\x1b\[[0-9;]*m`)
		cleanLine := re.ReplaceAllString(line, "")

		// Remove carriage returns
		cleanLine = strings.ReplaceAll(cleanLine, "\r", "")

		// Trim whitespace but keep empty lines for structure
		cleanLine = strings.TrimRight(cleanLine, " \t")
		cleanLines = append(cleanLines, cleanLine)
	}

	return strings.Join(cleanLines, "\n")
}

func (tb *TmuxBridge) isCommandComplete(output string) bool {
	lines := strings.Split(output, "\n")
	if len(lines) == 0 {
		return false
	}

	lastLine := strings.TrimSpace(lines[len(lines)-1])

	// Check for common shell prompts
	promptPatterns := []string{
		`\$\s*$`, // Bash/Zsh prompt ending with $
		`#\s*$`,  // Root prompt ending with #
		`>\s*$`,  // Windows prompt ending with >
		`%\s*$`,  // Some shell prompts ending with %
	}

	for _, pattern := range promptPatterns {
		matched, _ := regexp.MatchString(pattern, lastLine)
		if matched {
			return true
		}
	}

	return false
}

func (tb *TmuxBridge) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := tb.upgrader.Upgrade(w, r, nil)
	if err != nil {
		tb.logger.WithError(err).Error("WebSocket upgrade failed")
		return
	}
	defer conn.Close()

	tb.addClient(conn)
	defer tb.removeClient(conn)

	tb.logger.Info("New WebSocket client connected")

	// Send welcome message
	welcomeMsg := Message{
		Type:   "status",
		Status: "connected",
		Output: fmt.Sprintf("Connected to tmux session: %s, pane: %s", tb.config.TmuxSession, tb.config.TmuxPane),
	}
	conn.WriteJSON(welcomeMsg)

	for {
		var msg Message
		if err := conn.ReadJSON(&msg); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				tb.logger.WithError(err).Error("WebSocket error")
			}
			break
		}

		switch msg.Type {
		case "execute":
			if msg.Command == "" {
				conn.WriteJSON(Message{
					Type:  "error",
					Error: "Command is required",
					ID:    msg.ID,
				})
				continue
			}
			go tb.executeCommand(msg.Command, msg.ID)

		case "ping":
			conn.WriteJSON(Message{Type: "pong", ID: msg.ID})

		default:
			conn.WriteJSON(Message{
				Type:  "error",
				Error: fmt.Sprintf("Unknown message type: %s", msg.Type),
				ID:    msg.ID,
			})
		}
	}
}

func (tb *TmuxBridge) healthCheck(w http.ResponseWriter, r *http.Request) {
	if err := tb.checkTmuxSession(); err != nil {
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "healthy",
		"session": tb.config.TmuxSession,
		"pane":    tb.config.TmuxPane,
	})
}

func (tb *TmuxBridge) Start() error {
	if err := tb.checkTmuxSession(); err != nil {
		return err
	}

	http.HandleFunc("/ws", tb.handleWebSocket)
	http.HandleFunc("/health", tb.healthCheck)

	// Serve static files for the test client
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.ServeFile(w, r, "client.html")
			return
		}
		http.NotFound(w, r)
	})

	server := &http.Server{Addr: ":" + tb.config.Port}

	// Graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan

		tb.logger.Info("Shutting down server...")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		server.Shutdown(ctx)
	}()

	tb.logger.WithField("port", tb.config.Port).Info("Starting tmux-claude-bridge server")
	return server.ListenAndServe()
}

func loadConfig() Config {
	config := Config{
		Port:        "8080",
		TmuxSession: "claude-bridge",
		TmuxPane:    "1",
		LogLevel:    "info",
	}

	if configFile := os.Getenv("CONFIG_FILE"); configFile != "" {
		if data, err := os.ReadFile(configFile); err == nil {
			json.Unmarshal(data, &config)
		}
	}

	// Environment variable overrides
	if port := os.Getenv("PORT"); port != "" {
		config.Port = port
	}
	if session := os.Getenv("TMUX_SESSION"); session != "" {
		config.TmuxSession = session
	}
	if pane := os.Getenv("TMUX_PANE"); pane != "" {
		config.TmuxPane = pane
	}
	if logLevel := os.Getenv("LOG_LEVEL"); logLevel != "" {
		config.LogLevel = logLevel
	}

	return config
}

func main() {
	config := loadConfig()
	bridge := NewTmuxBridge(config)

	if err := bridge.Start(); err != nil && err != http.ErrServerClosed {
		bridge.logger.WithError(err).Fatal("Server failed to start")
	}
}
