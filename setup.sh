#!/bin/bash

# Tmux Terminal MCP - Automated Setup Script
# This script helps install and configure the MCP server for Claude Code

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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
    echo -e "${BLUE}=================================================${NC}"
    echo -e "${BLUE} Tmux Terminal MCP - Setup Script${NC}"
    echo -e "${BLUE}=================================================${NC}"
    echo ""
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js not found. Please install Node.js 18+ first."
        log_info "Visit: https://nodejs.org/en/download/"
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)
    
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        log_error "Node.js version $NODE_VERSION found. Required: 18+"
        log_info "Please update Node.js to version 18 or higher."
        exit 1
    fi
    
    log_success "Node.js version $NODE_VERSION ✓"
    
    # Check tmux
    if ! command -v tmux &> /dev/null; then
        log_error "tmux not found. Please install tmux first."
        log_info "macOS: brew install tmux"
        log_info "Ubuntu: apt-get install tmux"
        log_info "CentOS: yum install tmux"
        exit 1
    fi
    
    TMUX_VERSION=$(tmux -V)
    log_success "$TMUX_VERSION ✓"
    
    # Check Claude
    if ! command -v clause &> /dev/null; then
        log_warning "Claude not found in PATH"
        log_info "Please ensure Claude is installed and available"
        log_info "Visit: https://docs.anthropic.com/claude/docs"
    else
        log_success "Claude found ✓"
    fi
    
    log_success "Prerequisites check completed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing Node.js dependencies..."
    
    if [ ! -f "package.json" ]; then
        log_error "package.json not found. Are you in the correct directory?"
        exit 1
    fi
    
    npm install
    log_success "Dependencies installed"
}

# Run tests
run_tests() {
    log_info "Running tests to verify installation..."
    
    if npm test; then
        log_success "All tests passed ✓"
    else
        log_error "Tests failed. Please check the installation."
        exit 1
    fi
}

# Make server executable
setup_permissions() {
    log_info "Setting up permissions..."
    chmod +x mcp-server.js
    log_success "Made mcp-server.js executable"
}

# Generate MCP configuration
generate_mcp_config() {
    local project_dir=$(pwd)
    
    log_info "Generating MCP configuration..."
    
    cat > mcp-config-template.json << EOF
{
  "tmux-terminal": {
    "command": "node",
    "args": ["$project_dir/mcp-server.js"],
    "cwd": "$project_dir"
  }
}
EOF
    
    log_success "MCP configuration template created: mcp-config-template.json"
    echo ""
    log_info "To install this MCP in Claude:"
    echo ""
    echo "Manual installation:"
    echo "   - Copy the configuration from mcp-config-template.json"
    echo "   - Add it to ~/.config/clause/mcp_servers.json"
    echo ""
}

# Create sample tmux session
create_sample_session() {
    log_info "Would you like to create a sample tmux session for testing? [y/N]"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        SESSION_NAME="tmux-mcp-test"
        
        if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
            log_info "Test session '$SESSION_NAME' already exists"
            log_info "To attach: tmux attach-session -t $SESSION_NAME"
        else
            log_info "Creating test tmux session: $SESSION_NAME"
            
            # Create session in detached mode
            tmux new-session -d -s "$SESSION_NAME" -c "$PWD"
            
            # Split window to create a right pane for CT Pane
            tmux split-window -h -t "$SESSION_NAME"
            
            # Select the left pane
            tmux select-pane -t "$SESSION_NAME:0.0"
            
            log_success "Created tmux session '$SESSION_NAME' with 2 panes"
            log_info "To use: tmux attach-session -t $SESSION_NAME"
            log_info "Then start Claude Code from within the tmux session"
        fi
    fi
}

# Provide usage instructions
show_usage_instructions() {
    echo ""
    log_header
    log_success "Setup completed successfully!"
    echo ""
    log_info "Next steps to use the Tmux Terminal MCP:"
    echo ""
    echo "1. Configure Claude (see mcp-config-template.json)"
    echo "2. Start a tmux session: tmux new-session -s myproject"
    echo "3. Navigate to your project directory in tmux"
    echo "4. Launch Claude from within tmux: clause"
    echo "5. Claude will auto-detect tmux and offer to create a CT Pane"
    echo ""
    log_info "For detailed usage examples, see README.md"
    log_info "For troubleshooting, see INSTALL.md"
    echo ""
    log_success "Happy coding with Claude and tmux! 🚀"
}

# Main setup flow
main() {
    log_header
    
    check_prerequisites
    echo ""
    
    install_dependencies
    echo ""
    
    run_tests
    echo ""
    
    setup_permissions
    echo ""
    
    generate_mcp_config
    echo ""
    
    create_sample_session
    echo ""
    
    show_usage_instructions
}

# Run main function
main "$@"