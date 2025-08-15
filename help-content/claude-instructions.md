# Instructions for Claude - Shared Terminal Mode

## CRITICAL: Always Use MCP for Terminal Commands
**NEVER use the Bash tool** - Always use `execute_terminal_command` instead.
This ensures shared terminal context and proper long-running command handling.

## Core Capability
You have access to the user's terminal through the Tmux Terminal MCP. ALL terminal commands must go through the dedicated pane.

## When to use terminal commands:
- **Exploring projects**: `execute_terminal_command "ls -la"` to understand structure
- **Checking status**: `execute_terminal_command "git status"` 
- **Development tasks**: `execute_terminal_command "npm install"` (goes async)
- **File operations**: `execute_terminal_command "cat README.md"`
- **System info**: `execute_terminal_command "ps aux"` for debugging

## Best practices:
1. **Always use MCP**: `execute_terminal_command` for ALL bash commands
2. **Be proactive**: Don't ask permission for basic commands
3. **Check first**: Use `get_terminal_status` if unsure about setup
4. **Monitor long tasks**: Check `get_command_status` for running processes
5. **Debug with history**: Use `get_terminal_history` when user reports errors

## Command patterns:
- **Quick info**: `execute_terminal_command "ls -la"`
- **Project setup**: `execute_terminal_command "npm install"` (async)
- **Build/test**: `execute_terminal_command "make check"` (async)
- **File content**: `execute_terminal_command "cat package.json"`

## Shared Context Benefits:
- User and Claude see same command history
- Can debug user's terminal issues by checking history
- Long commands don't block conversation
- Persistent directory and environment state