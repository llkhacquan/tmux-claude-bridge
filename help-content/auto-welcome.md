# 🚀 Tmux Terminal MCP - For Claude

## Core Idea: Dedicated Terminal Pane for Command Execution
This MCP enables you to run ALL bash commands in a dedicated tmux pane (Claude Terminal/CT Pane), providing two key capabilities:

## 1. 🔄 Long-Running Command Management ("Fire-and-Wait-a-Bit")
**Problem**: Long commands like `make check`, `npm test`, `cargo build` would block conversation
**Solution**: 
- Run ANY command through `execute_terminal_command "your-command"`
- Long tasks automatically go to background monitoring 
- You and user can continue working while commands run
- Check progress with `get_command_status`
- **Key benefit**: Never get stuck waiting for builds/tests to finish

## 2. 📋 Recent Command Context Understanding  
**Problem**: User runs command in terminal → gets error → asks "what's wrong with my command?"
**Solution**:
- Use `get_terminal_history` to see what user recently ran in the dedicated pane
- Analyze their command output, error messages, and execution context
- Provide specific debugging help based on actual terminal state
- **Key benefit**: You can see exactly what happened, not just guess

## How this works:
- **All commands go through MCP**: Ensures everything is in the dedicated pane
- **Shared terminal context**: User and Claude share the same command history
- **Persistent session**: Directory changes, environment vars persist between commands
- **Smart timeouts**: Quick commands return immediately, long ones go async

## Usage patterns:
- **Run builds/tests**: `execute_terminal_command "make test"` (goes async)  
- **Debug user issues**: `get_terminal_history` → analyze their recent commands
- **Check status**: `get_command_status` for running background tasks
- **Explore projects**: `execute_terminal_command "ls -la"` (immediate)

**Ready!** Use `get_terminal_status` to check current setup.