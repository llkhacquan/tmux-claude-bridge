# tmux-claude-bridge Makefile

# Variables
BINARY_NAME=tmux-claude-bridge
MAIN_PACKAGE=./
GO_FILES=$(shell find . -name "*.go" -type f -not -path "./vendor/*")
VERSION=$(shell git describe --tags --always --dirty)
BUILD_TIME=$(shell date -u '+%Y-%m-%d_%H:%M:%S')
LDFLAGS=-ldflags "-X main.Version=$(VERSION) -X main.BuildTime=$(BUILD_TIME)"

# Colors for output
RED=\033[0;31m
GREEN=\033[0;32m
YELLOW=\033[1;33m
BLUE=\033[0;34m
NC=\033[0m # No Color

.PHONY: all build clean test lint fmt vet install deps dev setup-tmux health check-deps help

# Default target
all: clean deps lint test build

# Help target
help: ## Show this help message
	@echo "$(BLUE)tmux-claude-bridge Makefile$(NC)"
	@echo ""
	@echo "$(GREEN)Available targets:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(BLUE)%-15s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Dependency management
deps: ## Install Go dependencies
	@echo "$(YELLOW)Installing dependencies...$(NC)"
	go mod download
	go mod tidy

check-deps: ## Check if required tools are installed
	@echo "$(YELLOW)Checking dependencies...$(NC)"
	@which go >/dev/null 2>&1 || (echo "$(RED)Error: Go is not installed$(NC)" && exit 1)
	@which tmux >/dev/null 2>&1 || (echo "$(RED)Error: tmux is not installed$(NC)" && exit 1)
	@echo "$(GREEN)✓ All dependencies are installed$(NC)"

# Build targets
build: deps ## Build the application
	@echo "$(YELLOW)Building $(BINARY_NAME)...$(NC)"
	go build $(LDFLAGS) -o $(BINARY_NAME) $(MAIN_PACKAGE)
	@echo "$(GREEN)✓ Build completed: $(BINARY_NAME)$(NC)"

build-debug: deps ## Build with debug information
	@echo "$(YELLOW)Building $(BINARY_NAME) with debug info...$(NC)"
	go build -gcflags="all=-N -l" -o $(BINARY_NAME) $(MAIN_PACKAGE)
	@echo "$(GREEN)✓ Debug build completed: $(BINARY_NAME)$(NC)"

install: build ## Install the binary to GOPATH/bin
	@echo "$(YELLOW)Installing $(BINARY_NAME)...$(NC)"
	go install $(LDFLAGS) $(MAIN_PACKAGE)
	@echo "$(GREEN)✓ Installed $(BINARY_NAME)$(NC)"

# Development targets
dev: build setup-tmux ## Build and setup development environment
	@echo "$(GREEN)✓ Development environment ready$(NC)"
	@echo "$(BLUE)Run 'make run' to start the server$(NC)"

run: build ## Build and run the application
	@echo "$(YELLOW)Starting $(BINARY_NAME)...$(NC)"
	./$(BINARY_NAME)

run-debug: build-debug ## Build and run with debug mode
	@echo "$(YELLOW)Starting $(BINARY_NAME) in debug mode...$(NC)"
	LOG_LEVEL=debug ./$(BINARY_NAME)

# Testing targets
test: ## Run all tests
	@echo "$(YELLOW)Running tests...$(NC)"
	go test -v -race -coverprofile=coverage.out ./...
	@echo "$(GREEN)✓ Tests completed$(NC)"

test-coverage: test ## Run tests and show coverage
	@echo "$(YELLOW)Generating coverage report...$(NC)"
	go tool cover -html=coverage.out -o coverage.html
	@echo "$(GREEN)✓ Coverage report generated: coverage.html$(NC)"

test-integration: build ## Run integration tests
	@echo "$(YELLOW)Running integration tests...$(NC)"
	@if [ ! -f "./scripts/integration-test.sh" ]; then \
		echo "$(RED)Integration test script not found$(NC)"; \
		exit 1; \
	fi
	@chmod +x ./scripts/integration-test.sh
	./scripts/integration-test.sh
	@echo "$(GREEN)✓ Integration tests completed$(NC)"

# Code quality targets
lint: ## Run linter (requires golangci-lint)
	@echo "$(YELLOW)Running linter...$(NC)"
	@if command -v golangci-lint >/dev/null 2>&1; then \
		golangci-lint run --timeout=5m; \
		echo "$(GREEN)✓ Linting completed$(NC)"; \
	else \
		echo "$(YELLOW)Warning: golangci-lint not found, skipping...$(NC)"; \
		echo "Install with: curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $$(go env GOPATH)/bin v1.54.2"; \
	fi

fmt: ## Format Go code
	@echo "$(YELLOW)Formatting code...$(NC)"
	go fmt ./...
	@echo "$(GREEN)✓ Code formatted$(NC)"

vet: ## Run go vet
	@echo "$(YELLOW)Running go vet...$(NC)"
	go vet ./...
	@echo "$(GREEN)✓ go vet completed$(NC)"

# tmux setup
setup-tmux: ## Create tmux session for development
	@echo "$(YELLOW)Setting up tmux session using script...$(NC)"
	@if [ -f "./scripts/setup-tmux.sh" ]; then \
		AUTO_ATTACH=false ./scripts/setup-tmux.sh; \
	else \
		echo "$(RED)Error: setup-tmux.sh script not found$(NC)"; \
		exit 1; \
	fi

kill-tmux: ## Kill the tmux session
	@echo "$(YELLOW)Killing tmux session...$(NC)"
	@if tmux has-session -t claude-bridge 2>/dev/null; then \
		tmux kill-session -t claude-bridge; \
		echo "$(GREEN)✓ tmux session 'claude-bridge' killed$(NC)"; \
	else \
		echo "$(YELLOW)tmux session 'claude-bridge' does not exist$(NC)"; \
	fi

# Health and status
health: ## Check application health
	@echo "$(YELLOW)Checking application health...$(NC)"
	@if curl -f http://localhost:8080/health >/dev/null 2>&1; then \
		echo "$(GREEN)✓ Application is healthy$(NC)"; \
		curl -s http://localhost:8080/health | jq .; \
	else \
		echo "$(RED)✗ Application is not responding$(NC)"; \
		echo "$(BLUE)Make sure the server is running with 'make run'$(NC)"; \
	fi

status: ## Show project status
	@echo "$(BLUE)tmux-claude-bridge Status:$(NC)"
	@echo "  Version: $(VERSION)"
	@echo "  Build Time: $(BUILD_TIME)"
	@echo "  Binary: $(BINARY_NAME)"
	@echo ""
	@echo "$(YELLOW)tmux sessions:$(NC)"
	@tmux list-sessions 2>/dev/null || echo "  No tmux sessions running"
	@echo ""
	@echo "$(YELLOW)Go environment:$(NC)"
	@echo "  Go version: $$(go version | cut -d' ' -f3)"
	@echo "  GOPATH: $$(go env GOPATH)"
	@echo "  GOOS: $$(go env GOOS)"
	@echo "  GOARCH: $$(go env GOARCH)"

# Cleanup targets
clean: ## Clean build artifacts
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	rm -f $(BINARY_NAME)
	rm -f coverage.out coverage.html
	go clean -cache
	@echo "$(GREEN)✓ Cleaned build artifacts$(NC)"

clean-all: clean kill-tmux ## Clean everything including tmux session
	@echo "$(GREEN)✓ Full cleanup completed$(NC)"

# Release targets
release: clean deps lint test build ## Prepare release build
	@echo "$(GREEN)✓ Release build completed$(NC)"
	@echo "$(BLUE)Binary ready: $(BINARY_NAME)$(NC)"

# Quick development workflow
quick: fmt vet test build ## Quick build pipeline (format, vet, test, build)
	@echo "$(GREEN)✓ Quick build pipeline completed$(NC)"

# Watch for changes (requires entr)
watch: ## Watch for file changes and rebuild (requires entr)
	@echo "$(YELLOW)Watching for changes... (Press Ctrl+C to stop)$(NC)"
	@if command -v entr >/dev/null 2>&1; then \
		find . -name "*.go" | entr -r make quick; \
	else \
		echo "$(RED)Error: entr is required for watch mode$(NC)"; \
		echo "Install with: brew install entr (macOS) or apt-get install entr (Ubuntu)"; \
	fi

# Docker targets (for future use)
docker-build: ## Build Docker image
	@echo "$(YELLOW)Building Docker image...$(NC)"
	docker build -t $(BINARY_NAME):$(VERSION) .
	@echo "$(GREEN)✓ Docker image built: $(BINARY_NAME):$(VERSION)$(NC)"

# MCP server targets
mcp-install: ## Install MCP server dependencies
	@echo "$(YELLOW)Installing MCP server dependencies...$(NC)"
	@if [ -d "mcp-server" ]; then \
		cd mcp-server && npm install; \
		echo "$(GREEN)✓ MCP server dependencies installed$(NC)"; \
	else \
		echo "$(RED)Error: mcp-server directory not found$(NC)"; \
		exit 1; \
	fi

mcp-test: ## Test MCP server functionality
	@echo "$(YELLOW)Testing MCP server...$(NC)"
	@if [ -f "mcp-server/server.js" ]; then \
		cd mcp-server && node --test test/*.test.js 2>/dev/null || echo "$(YELLOW)No tests found$(NC)"; \
		echo "$(GREEN)✓ MCP server validation completed$(NC)"; \
	else \
		echo "$(RED)Error: MCP server not found$(NC)"; \
		exit 1; \
	fi

mcp-dev: ## Run MCP server in development mode
	@echo "$(YELLOW)Starting MCP server in development mode...$(NC)"
	@cd mcp-server && npm run dev

# Combined development workflow
dev-full: build setup-tmux mcp-install ## Full development setup
	@echo "$(GREEN)✓ Full development environment ready$(NC)"
	@echo "$(BLUE)Next steps:$(NC)"
	@echo "  1. Terminal 1: make run        (start bridge server)"
	@echo "  2. Terminal 2: make mcp-dev    (start MCP server)"  
	@echo "  3. Terminal 3: claude-code     (start Claude Code)"

# Show configuration
config: ## Show current configuration
	@echo "$(BLUE)Current Configuration:$(NC)"
	@echo "  PORT: $${PORT:-8080}"
	@echo "  TMUX_SESSION: $${TMUX_SESSION:-claude-bridge}"
	@echo "  TMUX_PANE: $${TMUX_PANE:-1}"
	@echo "  LOG_LEVEL: $${LOG_LEVEL:-info}"
	@echo "  CONFIG_FILE: $${CONFIG_FILE:-<not set>}"
	@echo "  TMUX_BRIDGE_URL: $${TMUX_BRIDGE_URL:-ws://localhost:8080/ws}"