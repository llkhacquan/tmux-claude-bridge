# Best Practices for MCP Terminal Usage

## 🚨 Rule #1: NEVER Use Default Bash Tool
**ALWAYS use `execute_terminal_command`** for ANY shell command execution. The default Bash tool is incompatible with shared terminal context.

## Essential Practices:

1. **Start with Status Check**: Always begin with `get_terminal_status` to verify CT Pane
2. **Let MCP Handle Strategy**: Don't manually specify `wait_for_completion` unless needed
3. **Monitor Long Tasks**: Use `get_command_status` for background commands (npm install, builds)
4. **Multi-Pane Targeting**: Use `target_pane` parameter for specific pane operations
5. **Interactive Commands**: MCP automatically switches focus when needed (sudo, git commit)
6. **History for Debugging**: Use `get_terminal_history` to troubleshoot user issues

## Command Execution Flow:
```
1. get_terminal_status (verify setup)
2. execute_terminal_command (run your command) 
3. get_command_status (check if still running)
4. get_terminal_history (debug if needed)
```

## ❌ Common Mistakes:
- Using `Bash(command: "...")` instead of MCP tools
- Not checking terminal status first  
- Manual focus switching instead of letting MCP handle it
- Not monitoring long-running commands