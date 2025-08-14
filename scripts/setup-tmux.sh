#!/bin/bash

# tmux-claude-bridge Session Setup Script
# Sets up a tmux session for development with Claude integration

set -euo pipefail

# Configuration
SESSION_NAME="${TMUX_SESSION:-claude-bridge}"
WINDOW_WIDTH="${WINDOW_WIDTH:-120}"
WINDOW_HEIGHT="${WINDOW_HEIGHT:-40}"
FORCE_RECREATE="${FORCE_RECREATE:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_header() {
    echo -e "\n${PURPLE}=== $1 ===${NC}\n"
}

# Check if tmux is installed
check_tmux() {
    if ! command -v tmux &> /dev/null; then
        log_error "tmux is not installed. Please install it first:"
        echo "  macOS: brew install tmux"
        echo "  Ubuntu/Debian: sudo apt-get install tmux"
        echo "  CentOS/RHEL: sudo yum install tmux"
        exit 1
    fi
    
    local tmux_version
    tmux_version=$(tmux -V | cut -d' ' -f2)
    log_info "Found tmux version: $tmux_version"
}

# Check if session exists
session_exists() {
    tmux has-session -t "$SESSION_NAME" 2>/dev/null
}

# Kill existing session
kill_session() {
    if session_exists; then
        log_info "Killing existing session: $SESSION_NAME"
        tmux kill-session -t "$SESSION_NAME"
        log_success "Session killed"
    fi
}

# Create the tmux session
create_session() {
    log_info "Creating tmux session: $SESSION_NAME"
    
    # Create new session detached with specified dimensions
    tmux new-session -d -s "$SESSION_NAME" -x "$WINDOW_WIDTH" -y "$WINDOW_HEIGHT"
    
    # Rename the default window
    tmux rename-window -t "$SESSION_NAME:0" "claude-bridge"
    
    # Split the window horizontally (left and right panes)
    tmux split-window -h -t "$SESSION_NAME:0"
    
    # Configure left pane (pane 0) - Claude Code pane
    tmux select-pane -t "$SESSION_NAME:0.0"
    tmux send-keys -t "$SESSION_NAME:0.0" 'echo "📝 Claude Code Pane"' Enter
    tmux send-keys -t "$SESSION_NAME:0.0" 'echo "Use this pane for Claude interactions"' Enter
    tmux send-keys -t "$SESSION_NAME:0.0" 'echo "Commands will be executed in the right pane"' Enter
    tmux send-keys -t "$SESSION_NAME:0.0" 'echo ""' Enter
    
    # Configure right pane (pane 1) - Terminal execution pane  
    tmux select-pane -t "$SESSION_NAME:0.1"
    tmux send-keys -t "$SESSION_NAME:0.1" 'echo "🖥️  Terminal Execution Pane"' Enter
    tmux send-keys -t "$SESSION_NAME:0.1" 'echo "Commands from Claude will execute here"' Enter
    tmux send-keys -t "$SESSION_NAME:0.1" 'echo "Session: $SESSION_NAME, Pane: 1"' Enter
    tmux send-keys -t "$SESSION_NAME:0.1" 'echo ""' Enter
    
    # Set pane titles
    tmux select-pane -t "$SESSION_NAME:0.0" -T "Claude Code"
    tmux select-pane -t "$SESSION_NAME:0.1" -T "Terminal"
    
    # Configure pane borders and status
    tmux set-option -t "$SESSION_NAME" pane-border-status top
    tmux set-option -t "$SESSION_NAME" pane-border-format "#{pane_title}"
    
    # Set status bar
    tmux set-option -t "$SESSION_NAME" status on
    tmux set-option -t "$SESSION_NAME" status-position bottom
    tmux set-option -t "$SESSION_NAME" status-left "#[fg=green]Session: $SESSION_NAME #[fg=yellow]| "
    tmux set-option -t "$SESSION_NAME" status-right "#[fg=cyan]tmux-claude-bridge #[fg=yellow]| #[fg=white]%H:%M:%S"
    
    # Select left pane by default
    tmux select-pane -t "$SESSION_NAME:0.0"
    
    log_success "Session created successfully"
}

# Add development window
add_dev_window() {
    log_info "Adding development window"
    
    # Create a new window for development
    tmux new-window -t "$SESSION_NAME" -n "development"
    
    # Split into 3 panes: editor (top), logs (bottom left), server (bottom right)
    tmux split-window -v -t "$SESSION_NAME:development"
    tmux split-window -h -t "$SESSION_NAME:development.1"
    
    # Configure panes
    tmux select-pane -t "$SESSION_NAME:development.0" -T "Editor"
    tmux select-pane -t "$SESSION_NAME:development.1" -T "Logs"  
    tmux select-pane -t "$SESSION_NAME:development.2" -T "Server"
    
    # Set up editor pane
    tmux send-keys -t "$SESSION_NAME:development.0" 'echo "📝 Development Editor"' Enter
    tmux send-keys -t "$SESSION_NAME:development.0" 'echo "Use this for editing code"' Enter
    
    # Set up logs pane  
    tmux send-keys -t "$SESSION_NAME:development.1" 'echo "📊 Logs & Monitoring"' Enter
    tmux send-keys -t "$SESSION_NAME:development.1" 'echo "Monitor application logs here"' Enter
    
    # Set up server pane
    tmux send-keys -t "$SESSION_NAME:development.2" 'echo "🚀 Server"' Enter
    tmux send-keys -t "$SESSION_NAME:development.2" 'echo "Run the tmux-claude-bridge server here:"' Enter
    tmux send-keys -t "$SESSION_NAME:development.2" 'echo "  make run"' Enter
    
    log_success "Development window added"
}

# Show session info
show_session_info() {
    log_header "Session Information"
    
    echo "Session Name: $SESSION_NAME"
    echo "Window Dimensions: ${WINDOW_WIDTH}x${WINDOW_HEIGHT}"
    echo ""
    
    log_info "Session layout:"
    tmux list-windows -t "$SESSION_NAME" -F "  Window #{window_index}: #{window_name}"
    
    log_info "Panes in main window:"
    tmux list-panes -t "$SESSION_NAME:0" -F "  Pane #{pane_index}: #{pane_title} (#{pane_width}x#{pane_height})"
    
    if tmux list-windows -t "$SESSION_NAME" | grep -q "development"; then
        log_info "Panes in development window:"
        tmux list-panes -t "$SESSION_NAME:development" -F "  Pane #{pane_index}: #{pane_title} (#{pane_width}x#{pane_height})"
    fi
}

# Attach to session
attach_session() {
    log_header "Session Ready"
    log_success "tmux session '$SESSION_NAME' is ready!"
    echo ""
    log_info "To attach to the session:"
    echo "  tmux attach-session -t $SESSION_NAME"
    echo ""
    log_info "To detach from the session (inside tmux):"
    echo "  Press Ctrl+b, then d"
    echo ""
    log_info "To switch between windows (inside tmux):"
    echo "  Press Ctrl+b, then 0-9 (window number)"
    echo ""
    log_info "To switch between panes (inside tmux):"  
    echo "  Press Ctrl+b, then arrow keys"
    echo ""
    log_info "Bridge configuration:"
    echo "  Session: $SESSION_NAME"
    echo "  Target pane: 1 (right pane of main window)"
    echo ""
    
    # Auto-attach if in terminal and not already in tmux
    if [[ -t 0 ]] && [[ -z "${TMUX:-}" ]] && [[ "${AUTO_ATTACH:-true}" != "false" ]]; then
        log_info "Auto-attaching to session..."
        sleep 2
        exec tmux attach-session -t "$SESSION_NAME"
    fi
}

# Validate session
validate_session() {
    log_info "Validating session setup..."
    
    if ! session_exists; then
        log_error "Session validation failed: session does not exist"
        exit 1
    fi
    
    # Check if we have the expected panes
    local pane_count
    pane_count=$(tmux list-panes -t "$SESSION_NAME:0" | wc -l)
    
    if [[ $pane_count -ne 2 ]]; then
        log_error "Session validation failed: expected 2 panes, found $pane_count"
        exit 1
    fi
    
    # Test that we can send keys to pane 1
    if ! tmux send-keys -t "$SESSION_NAME:0.1" 'echo "Validation test"' Enter 2>/dev/null; then
        log_error "Session validation failed: cannot send keys to target pane"
        exit 1
    fi
    
    log_success "Session validation passed"
}

# Usage information
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Set up a tmux session for tmux-claude-bridge development.

OPTIONS:
    -h, --help          Show this help message
    -f, --force         Force recreate session if it exists
    -n, --name NAME     Session name (default: claude-bridge)
    -w, --width WIDTH   Window width (default: 120)
    -h, --height HEIGHT Window height (default: 40) 
    --no-attach         Don't auto-attach to session
    --dev               Add development window
    --validate-only     Only validate existing session

ENVIRONMENT VARIABLES:
    TMUX_SESSION        Session name (default: claude-bridge)
    WINDOW_WIDTH        Window width (default: 120)
    WINDOW_HEIGHT       Window height (default: 40)
    FORCE_RECREATE      Force recreate (default: false)
    AUTO_ATTACH         Auto-attach to session (default: true)

EXAMPLES:
    $0                              # Create session with defaults
    $0 --force                      # Force recreate existing session
    $0 --name my-session --dev      # Create session with development window
    $0 --validate-only              # Just validate existing session

EOF
}

# Parse command line arguments
parse_args() {
    local add_dev_window=false
    local validate_only=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -f|--force)
                FORCE_RECREATE=true
                shift
                ;;
            -n|--name)
                SESSION_NAME="$2"
                shift 2
                ;;
            -w|--width)
                WINDOW_WIDTH="$2"
                shift 2
                ;;
            --height)
                WINDOW_HEIGHT="$2" 
                shift 2
                ;;
            --no-attach)
                AUTO_ATTACH=false
                shift
                ;;
            --dev)
                add_dev_window=true
                shift
                ;;
            --validate-only)
                validate_only=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Handle validate-only mode
    if [[ $validate_only == true ]]; then
        check_tmux
        validate_session
        log_success "Session validation completed"
        exit 0
    fi
    
    # Set flag for dev window
    if [[ $add_dev_window == true ]]; then
        ADD_DEV_WINDOW=true
    fi
}

# Main function
main() {
    log_header "tmux-claude-bridge Session Setup"
    
    # Parse command line arguments
    parse_args "$@"
    
    # Check prerequisites
    check_tmux
    
    # Handle existing session
    if session_exists; then
        if [[ $FORCE_RECREATE == true ]]; then
            log_warning "Session '$SESSION_NAME' exists, recreating..."
            kill_session
        else
            log_warning "Session '$SESSION_NAME' already exists"
            log_info "Use --force to recreate, or attach with:"
            echo "  tmux attach-session -t $SESSION_NAME"
            exit 0
        fi
    fi
    
    # Create the session
    create_session
    
    # Add development window if requested
    if [[ ${ADD_DEV_WINDOW:-false} == true ]]; then
        add_dev_window
    fi
    
    # Validate the setup
    validate_session
    
    # Show information
    show_session_info
    
    # Attach to session
    attach_session
}

# Run main function with all arguments
main "$@"