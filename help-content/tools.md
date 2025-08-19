# MCP Terminal Tools - ALWAYS USE THESE INSTEAD OF BASH TOOL

## 🎯 Primary Tool (Use This for ALL Commands):

**`execute_terminal_command`** - Your ONLY way to run commands
- ✅ **USE FOR EVERYTHING**: ls, cd, git, npm, make, docker, etc.
- ✅ **Handles all scenarios**: quick commands, long builds, interactive prompts
- ✅ **Multi-pane support**: Use `target_pane` parameter for specific panes
- ✅ **Smart timeouts**: Auto-detects if command needs background monitoring

### Examples:
```javascript
execute_terminal_command("ls -la")                    // Quick command
execute_terminal_command("npm install")               // Long-running (async)
execute_terminal_command("git status", {target_pane: 2})  // Specific pane
```

## 🛠️ Supporting Tools:

1. **`get_terminal_status`** - Always check this first to verify CT Pane setup
2. **`create_claude_terminal`** - Create new CT Pane if needed  
3. **`switch_terminal_focus`** - Focus on CT Pane for user interaction
4. **`get_command_status`** - Monitor background/running commands
5. **`get_terminal_history`** - Debug by viewing recent command history
6. **`get_terminal_help`** - Show contextual help content

## 🚨 CRITICAL REMINDERS:
- **NEVER use the default Bash tool** when this MCP is active
- **ALWAYS start with `get_terminal_status`** to check CT Pane
- **USE `execute_terminal_command` for EVERY shell command**
- **Be proactive** - run commands immediately without asking