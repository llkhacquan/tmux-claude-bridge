# Debug Practices for Tmux Terminal MCP

## Dual Tool Debugging Approach

When MCP tools seem unavailable or behaving unexpectedly, use this two-tool comparison method:

### Tool 1: Direct Bash/tmux Commands
```bash
# Get current tmux session info
tmux display-message -p "Session: #S, Window: #I, Pane: #P"

# List all panes with details
tmux list-panes -F "Pane #{pane_index}: #{pane_width}x#{pane_height} at #{pane_current_path} (active: #{pane_active})"

# Get rightmost pane index
tmux list-panes -F "#{pane_index}" | tail -1

# Get shell PID for a specific pane
tmux display-message -t 0:4.1 -p '#{pane_pid}'

# Check child processes of shell
pgrep -P <shell_pid>

# Execute command in specific pane
tmux send-keys -t 0:4.1 'pwd' Enter

# Capture pane content
tmux capture-pane -t 0:4.1 -p
```

### Tool 2: MCP Tools
```
# Check MCP connection and status
get_terminal_status

# Execute command via MCP
execute_terminal_command "pwd"

# Create CT Pane if needed
create_claude_terminal

# Switch focus to CT Pane
switch_terminal_focus

# Check running command status
get_command_status
```

## Common Issues & Solutions

### Issue: "No such tool available"
**Cause**: MCP server not loaded or tool names incorrect
**Debug**: 
1. Check `claude mcp list`
2. Try full tool names like `mcp__tmux-terminal__execute_terminal_command`
3. Restart Claude and reconnect MCP

### Issue: "No Claude Terminal pane available" 
**Cause**: CT Pane not configured despite detection
**Debug**:
1. Use `get_terminal_status` to check actual state
2. Compare with direct `tmux list-panes`
3. Check if auto-discovery ran during initialization

### Issue: Commands hanging or not completing
**Cause**: Command completion detection failing
**Debug**:
1. Compare process monitoring vs output detection
2. Check shell PID: `tmux display-message -t <pane> -p '#{pane_pid}'`
3. Monitor child processes: `pgrep -P <shell_pid>`
4. Verify prompt patterns match current shell

## Debugging Session Results

**Date**: August 15, 2025
**Issue**: MCP tools appeared unavailable after process monitoring implementation
**Root Cause**: Tool names confusion - tools were actually working
**Resolution**: 
- Direct tmux: Showed 2 panes (0,1) with pane 1 as rightmost 
- MCP tools: Correctly configured CT Pane as pane 1
- Auto-discovery: Working perfectly
- Process monitoring: Detecting completion in 0.6s

**Key Finding**: Always verify tool availability with `get_terminal_status` before assuming MCP failure.

## Best Practices

1. **Always use dual debugging**: Compare direct tmux vs MCP results
2. **Check tool names**: Use correct MCP tool naming format
3. **Verify initialization**: Ensure auto-discovery completed successfully
4. **Document findings**: Save debugging sessions for future reference
5. **Test both approaches**: Process monitoring vs regex detection

## Process Monitoring Validation

**Shell PID Detection**: 
```bash
tmux display-message -t 0:4.1 -p '#{pane_pid}'  # Gets shell PID
pgrep -P <pid>  # Lists child processes
```

**Command Completion Logic**:
- Command running: `childProcesses.length > 0`
- Command complete: `childProcesses.length === 0`
- Much more reliable than regex prompt detection!

## Tool Name Reference

**Correct MCP tool names**:
- `mcp__tmux-terminal__execute_terminal_command`
- `mcp__tmux-terminal__get_terminal_status`  
- `mcp__tmux-terminal__create_claude_terminal`
- `mcp__tmux-terminal__switch_terminal_focus`
- `mcp__tmux-terminal__get_command_status`

Save this file for future Claude sessions to quickly debug MCP issues!