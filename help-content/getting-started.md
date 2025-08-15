# Getting Started

## 1. Prerequisites
- Must be running inside a tmux session
- Node.js environment with this MCP configured

## 2. First Time Setup
```bash
# Check status and auto-initialize
get_terminal_status

# If no CT Pane exists, create one
create_claude_terminal
```

## 3. Basic Usage
```bash
# Execute commands (automatically handled)
execute_terminal_command "ls -la"
execute_terminal_command "npm install"  # Long-running, goes to background

# Check what's happening
get_command_status
get_terminal_history

# Switch focus when needed
switch_terminal_focus
```