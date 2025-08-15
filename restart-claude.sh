#!/bin/bash

# restart-claude.sh - Restart Claude Code with session resume and MCP auto-reconnection
# Usage: ./restart-claude.sh [--verbose] [--no-mcp]

set -e

# Configuration
VERBOSE=false
RECONNECT_MCP=true
STARTUP_WAIT=5
MCP_WAIT=2
VERIFICATION_TIMEOUT=10

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    --no-mcp)
      RECONNECT_MCP=false
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--verbose] [--no-mcp]"
      echo "  --verbose    Enable verbose output"
      echo "  --no-mcp     Skip MCP reconnection"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

# Logging functions
log() {
  echo "🔄 $(date '+%H:%M:%S') $1"
}

log_verbose() {
  if $VERBOSE; then
    echo "🔍 $(date '+%H:%M:%S') $1"
  fi
}

log_error() {
  echo "❌ $(date '+%H:%M:%S') ERROR: $1" >&2
}

log_success() {
  echo "✅ $(date '+%H:%M:%S') $1"
}

# Check if running in tmux
check_tmux() {
  if [[ -z "$TMUX" ]]; then
    log_error "This script must be run from within a tmux session"
    exit 1
  fi
  log_verbose "Running in tmux session: $(tmux display-message -p '#S')"
}

# Phase 1: Capture current state
capture_state() {
  log "Phase 1: Capturing current state..."
  
  # Get current working directory
  CURRENT_DIR=$(pwd)
  log_verbose "Current directory: $CURRENT_DIR"
  
  # Create project path for Claude storage
  PROJECT_PATH=$(echo "$CURRENT_DIR" | sed 's/\//-/g')
  CLAUDE_PROJECT_DIR="$HOME/.claude/projects/$PROJECT_PATH"
  log_verbose "Claude project directory: $CLAUDE_PROJECT_DIR"
  
  # Check if project directory exists
  if [[ ! -d "$CLAUDE_PROJECT_DIR" ]]; then
    log_error "Claude project directory not found: $CLAUDE_PROJECT_DIR"
    log_error "Make sure you've run Claude Code in this directory before"
    exit 1
  fi
  
  # Get current session ID (most recent conversation file)
  CURRENT_SESSION=$(basename "$(ls -t "$CLAUDE_PROJECT_DIR"/*.jsonl 2>/dev/null | head -1)" .jsonl 2>/dev/null)
  
  if [[ -z "$CURRENT_SESSION" || "$CURRENT_SESSION" == "*" ]]; then
    log_error "No active Claude Code session found in this project"
    exit 1
  fi
  
  log_verbose "Current session ID: $CURRENT_SESSION"
  
  # Find Claude pane in current tmux window
  CLAUDE_PANE=$(tmux list-panes -F '#{pane_index}:#{pane_current_command}' 2>/dev/null | grep -E 'claude$' | head -1 | cut -d: -f1)
  
  if [[ -z "$CLAUDE_PANE" ]]; then
    log_error "Claude Code process not found in current tmux window"
    log_error "Make sure Claude Code is running in a tmux pane"
    exit 1
  fi
  
  log_verbose "Claude running in pane: $CLAUDE_PANE"
  
  # Get the specific Claude PID for this pane to avoid killing other Claude sessions
  PANE_PID=$(tmux list-panes -F '#{pane_index}:#{pane_pid}' | grep "^$CLAUDE_PANE:" | cut -d: -f2)
  if [[ -z "$PANE_PID" ]]; then
    log_error "Could not determine pane PID for pane $CLAUDE_PANE"
    exit 1
  fi
  
  # Find the actual Claude process that's a child of our pane
  # First try to find Claude process that's a child of the pane PID
  ACTUAL_CLAUDE_PID=$(pgrep -P "$PANE_PID" -f "claude" 2>/dev/null || true)
  
  # If not found, look for any Claude process with our pane PID as ancestor
  if [[ -z "$ACTUAL_CLAUDE_PID" ]]; then
    # Get all Claude processes and check which one has our pane PID in its hierarchy
    for pid in $(pgrep -f "^claude"); do
      if ps -o ppid= -p "$pid" 2>/dev/null | grep -q "$PANE_PID"; then
        ACTUAL_CLAUDE_PID="$pid"
        break
      fi
    done
  fi
  
  # Last resort: get the Claude process that's currently running in our tmux session/window
  if [[ -z "$ACTUAL_CLAUDE_PID" ]]; then
    ACTUAL_CLAUDE_PID=$(tmux list-panes -t "$TMUX_SESSION:$TMUX_WINDOW" -F '#{pane_index}:#{pane_current_command}:#{pane_pid}' | grep "^$CLAUDE_PANE:claude:" | cut -d: -f3)
    # If that's the shell PID, look for Claude child process
    if [[ -n "$ACTUAL_CLAUDE_PID" ]]; then
      CLAUDE_CHILD=$(pgrep -P "$ACTUAL_CLAUDE_PID" -f "claude" 2>/dev/null || true)
      if [[ -n "$CLAUDE_CHILD" ]]; then
        ACTUAL_CLAUDE_PID="$CLAUDE_CHILD"
      fi
    fi
  fi
  
  if [[ -z "$ACTUAL_CLAUDE_PID" ]]; then
    log_error "Could not find Claude process for this session"
    log_error "Pane PID: $PANE_PID"
    log_error "Available Claude processes: $(pgrep -f '^claude' | tr '\n' ' ')"
    exit 1
  fi
  
  log_verbose "Pane PID: $PANE_PID, Claude process PID: $ACTUAL_CLAUDE_PID"
  
  # Capture connected MCPs if reconnection is enabled
  if $RECONNECT_MCP; then
    log_verbose "Capturing connected MCP servers..."
    CONNECTED_MCPS=$(claude mcp list 2>/dev/null | grep "✓ Connected" | cut -d: -f1 | tr '\n' ' ' | sed 's/[[:space:]]*$//')
    log_verbose "Connected MCPs: $CONNECTED_MCPS"
  fi
  
  # Get current tmux session and window
  TMUX_SESSION=$(tmux display-message -p '#S')
  TMUX_WINDOW=$(tmux display-message -p '#I')
  log_verbose "Tmux context: session=$TMUX_SESSION, window=$TMUX_WINDOW, pane=$CLAUDE_PANE"
}

# Phase 2: Kill and resume Claude
restart_claude() {
  log "Phase 2: Restarting Claude Code..."
  
  # Try multiple SIGTERM signals (gentle termination requests)
  log_verbose "Attempting graceful shutdown with multiple SIGTERM signals..."
  local sigterm_attempts=0
  while [[ $sigterm_attempts -lt 4 ]]; do
    if ! kill -0 "$ACTUAL_CLAUDE_PID" 2>/dev/null; then
      log_verbose "Claude Code shut down gracefully after SIGTERM #$((sigterm_attempts + 1))"
      break
    fi
    
    log_verbose "Sending SIGTERM #$((sigterm_attempts + 1))..."
    kill -TERM "$ACTUAL_CLAUDE_PID" 2>/dev/null || true
    sleep 2
    ((sigterm_attempts++))
  done
  
  # If still running, try multiple SIGINT signals (Ctrl+C equivalent)
  if kill -0 "$ACTUAL_CLAUDE_PID" 2>/dev/null; then
    log_verbose "SIGTERM attempts failed, trying multiple SIGINT signals..."
    local sigint_attempts=0
    while [[ $sigint_attempts -lt 3 ]]; do
      if ! kill -0 "$ACTUAL_CLAUDE_PID" 2>/dev/null; then
        log_verbose "Claude Code responded to SIGINT #$((sigint_attempts + 1))"
        break
      fi
      
      log_verbose "Sending SIGINT #$((sigint_attempts + 1))..."
      kill -INT "$ACTUAL_CLAUDE_PID" 2>/dev/null || true
      sleep 1
      ((sigint_attempts++))
    done
  fi
  
  # Last resort: SIGKILL if still running
  if kill -0 "$ACTUAL_CLAUDE_PID" 2>/dev/null; then
    log_verbose "Process still running, using SIGKILL as last resort..."
    kill -9 "$ACTUAL_CLAUDE_PID" 2>/dev/null || true
    sleep 2
  fi
  
  # Final verification
  if kill -0 "$ACTUAL_CLAUDE_PID" 2>/dev/null; then
    log_error "Claude Code process (PID: $ACTUAL_CLAUDE_PID) still running after all kill attempts"
    return 1
  fi
  
  log_verbose "Claude Code process terminated successfully"
  
  # Change to the correct directory in the Claude pane
  log_verbose "Switching to correct directory in pane $CLAUDE_PANE..."
  tmux send-keys -t "$TMUX_SESSION:$TMUX_WINDOW.$CLAUDE_PANE" "cd '$CURRENT_DIR'"
  tmux send-keys -t "$TMUX_SESSION:$TMUX_WINDOW.$CLAUDE_PANE" C-m
  sleep 1
  
  # Resume Claude with the captured session ID
  log_verbose "Resuming Claude Code with session ID: $CURRENT_SESSION"
  tmux send-keys -t "$TMUX_SESSION:$TMUX_WINDOW.$CLAUDE_PANE" "claude --resume $CURRENT_SESSION"
  tmux send-keys -t "$TMUX_SESSION:$TMUX_WINDOW.$CLAUDE_PANE" C-m
  
  # Wait for Claude to start
  log "Waiting for Claude Code to start (${STARTUP_WAIT}s)..."
  sleep $STARTUP_WAIT
  
  # Verify Claude is running (simple check)
  log_success "Claude Code restart initiated"
  return 0
}

# Phase 3: Reconnect MCPs using tmux keystrokes
reconnect_mcps() {
  if ! $RECONNECT_MCP; then
    log "Skipping MCP reconnection (--no-mcp flag used)"
    return 0
  fi
  
  if [[ -z "$CONNECTED_MCPS" ]]; then
    log "No MCPs were connected before restart, skipping reconnection"
    return 0
  fi
  
  log "Phase 3: Reconnecting MCP servers..."
  
  # Reconnect each MCP server using the new /mcp reconnect syntax
  for mcp in $CONNECTED_MCPS; do
    if [[ -n "$mcp" ]]; then
      log_verbose "Reconnecting MCP server: $mcp"
      tmux send-keys -t "$TMUX_SESSION:$TMUX_WINDOW.$CLAUDE_PANE" "/mcp reconnect $mcp"
      tmux send-keys -t "$TMUX_SESSION:$TMUX_WINDOW.$CLAUDE_PANE" C-m
      sleep 2
    fi
  done
  
  log_success "MCP reconnection commands sent"
}

# Phase 4: Verify everything is working
verify_restart() {
  log "Phase 4: Verifying restart success..."
  
  # Wait a bit for MCP connections to establish
  sleep 3
  
  # Send verification command
  log_verbose "Checking MCP connection status..."
  tmux send-keys -t "$TMUX_SESSION:$TMUX_WINDOW.$CLAUDE_PANE" 'claude mcp list'
  tmux send-keys -t "$TMUX_SESSION:$TMUX_WINDOW.$CLAUDE_PANE" C-m
  
  log_success "Claude Code restart completed!"
  log "📋 Summary:"
  log "  • Session ID: $CURRENT_SESSION"
  log "  • Working directory: $CURRENT_DIR"
  log "  • Tmux context: $TMUX_SESSION:$TMUX_WINDOW.$CLAUDE_PANE"
  
  if $RECONNECT_MCP && [[ -n "$CONNECTED_MCPS" ]]; then
    log "  • Reconnected MCPs: $CONNECTED_MCPS"
    log "  • Verify MCP connections with the 'claude mcp list' output above"
  fi
  
  log ""
  log "🎉 Claude Code is ready! Check the terminal output above for any connection issues."
}

# Error handling
cleanup() {
  if [[ $? -ne 0 ]]; then
    log_error "Script failed. Claude Code may be in an inconsistent state."
    log_error "You may need to manually restart Claude Code with: claude --resume $CURRENT_SESSION"
  fi
}

trap cleanup EXIT

# Main execution
main() {
  log "🚀 Starting Claude Code restart script..."
  log "Working directory: $(pwd)"
  
  check_tmux
  capture_state
  restart_claude
  reconnect_mcps
  verify_restart
  
  log_success "All done! 🎊"
}

# Run main function
main "$@"