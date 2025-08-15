# Tmux Terminal MCP - User Guide

## Quick Start (Zero Setup Required!)

### 1. Start Claude
When you start a fresh Claude session, the MCP automatically announces itself to Claude:
```
💡 Claude: I have loaded the Tmux Terminal MCP for shared command execution.
    Use get_terminal_status or any MCP tool to see the setup guide and permission request.
```

### 2. Claude Sees the Announcement
Claude automatically knows the MCP is available and will proactively offer to use it.

### 3. First Interaction
When Claude first uses any MCP tool, you'll see:
- 🎯 **Auto-help guide** explaining the two key benefits
- 🤔 **Permission request**: "Should I run ALL terminal commands through the dedicated tmux pane?"

### 4. Give Permission
Reply **"yes"** to enable shared terminal mode. Claude will then:
- ✅ Automatically use the MCP for all bash commands
- ✅ Never block on long-running tasks (make, npm install, etc.)
- ✅ Be able to debug your terminal issues by reading command history

## What You Get

### 🔄 Fire-and-Wait-a-Bit
- Long commands (`make check`, `npm test`) run in background
- You and Claude can continue conversation while builds run
- No more waiting for commands to complete

### 📋 Shared Terminal Context  
- When you run a command and get an error, just ask: "What went wrong?"
- Claude can read the terminal history and see exactly what happened
- Better debugging and collaboration

## No Manual Setup Required!
The MCP server automatically announces itself to Claude when it loads. Just start using it!

## Advanced Usage
- Check status: Claude can run `get_terminal_status`
- View history: Claude can use `get_terminal_history` to debug issues
- Monitor long tasks: Claude tracks background processes with `get_command_status`