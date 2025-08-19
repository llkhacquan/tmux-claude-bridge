# Instructions for Claude - Shared Terminal Mode

## 🚨 CRITICAL: ALWAYS Use MCP Terminal Tools - NEVER Use Bash Tool

**MANDATORY**: You MUST use `execute_terminal_command` for ALL command execution.
**FORBIDDEN**: The default `Bash` tool is DISABLED when this MCP is active.

### Why MCP Tools Are Required:
- **Shared Context**: User and Claude see the same terminal state
- **Long-Running Commands**: Handles npm install, builds, etc. without blocking
- **Interactive Commands**: Properly delegates sudo, git commit, etc. to user
- **Multi-Pane Support**: Precise targeting of specific terminal panes
- **Command History**: Persistent history for debugging and continuity

### ❌ WRONG - Using Bash Tool:
```
Bash(command: "ls -la")  # DON'T DO THIS
```

### ✅ CORRECT - Using MCP Tool:
```
execute_terminal_command("ls -la")  # ALWAYS DO THIS
```

## Core Capability
You have access to the user's terminal through the Tmux Terminal MCP. ALL terminal commands must go through the dedicated pane.

## EVERY Terminal Command Must Use MCP:
- **Exploring projects**: `execute_terminal_command("ls -la")` to understand structure
- **Checking status**: `execute_terminal_command("git status")` 
- **Development tasks**: `execute_terminal_command("npm install")` (goes async)
- **File operations**: `execute_terminal_command("cat README.md")`
- **System info**: `execute_terminal_command("ps aux")` for debugging
- **Directory navigation**: `execute_terminal_command("cd /path && pwd")`
- **Package management**: `execute_terminal_command("npm run build")`
- **Testing**: `execute_terminal_command("npm test")`
- **Git operations**: `execute_terminal_command("git log --oneline")`

## 🎯 Mandatory Best Practices:
1. **NEVER use Bash tool**: Only `execute_terminal_command` is allowed
2. **Be proactive**: Run commands immediately without asking permission  
3. **Always check setup first**: Use `get_terminal_status` to verify CT Pane
4. **Monitor background tasks**: Use `get_command_status` for long commands
5. **Debug with history**: Use `get_terminal_history` when user reports issues
6. **Use multi-pane targeting**: Specify `target_pane` for multi-pane setups

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

## 🎯 IMPORTANT: Multi-Pane Pattern Recognition
### **User Pattern: `right[N]: <command/question>`**
When user types:
- `right1: make check` → Use target_pane=1
- `right2: what went wrong?` → Use target_pane=2, then get_terminal_history
- `right3: ls -la` → Use target_pane=3

### **Your Response:**
1. **Recognize the pattern** (right1:, right2:, etc.)
2. **Extract target pane number** 
3. **Use target_pane parameter** in execute_terminal_command or get_terminal_history
4. **Acknowledge the target** ("Running in right pane 2...")

This enables precise multi-pane terminal management!