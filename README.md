# Tmux Terminal MCP

A pure Node.js MCP (Model Context Protocol) server that provides intelligent tmux terminal management for Claude Code. Features the innovative **Claude Terminal (CT Pane)** concept with "Fire and Wait Briefly" execution strategy.

## 🎯 Core Concept: Claude Terminal (CT Pane)

The **Claude Terminal** is a dedicated tmux pane for Claude's command execution, providing clean separation between your interactive work and Claude's automated tasks. This prevents command interference and gives you full control over both environments.

## ✨ Key Features

### 🧠 Intelligent Startup Behavior
- Auto-detects tmux environment and current session
- Scans window layout to find suitable Claude Terminal pane
- Smart CT Pane discovery with helpful suggestions
- Automatic directory synchronization

### ⚡ "Fire and Wait Briefly" Execution Strategy
```
1. Send command to CT Pane via tmux send-keys
2. Wait up to 5 seconds for quick commands
3. For long-running commands: Switch to background monitoring
4. Auto-notify when commands complete
5. Handle interactive prompts intelligently
```

### 🎛️ Interactive Command Handling
- Detects interactive prompts (sudo passwords, confirmations, editors)
- Auto-switches focus to CT Pane when user interaction needed
- Never intercepts sensitive input - delegates to user safely
- Handles: sudo prompts, git commit editors, REPLs, monitoring tools

### 🔧 MCP Tools Provided

| Tool | Description |
|------|-------------|
| `execute_terminal_command` | Execute commands with intelligent timeout handling |
| `get_terminal_status` | Show CT Pane and tmux environment status |
| `create_claude_terminal` | Create new CT Pane if needed |
| `switch_terminal_focus` | Switch tmux focus to CT Pane |
| `get_command_status` | Check status of running background commands |

## 🏗️ Architecture

```
Claude Code <--MCP Protocol--> Node.js MCP Server <--child_process--> tmux commands
```

## 🚀 Installation & Setup

### Prerequisites
- Node.js 18+ 
- tmux installed and running
- Must run the MCP server from within a tmux session

### Install Dependencies
```bash
npm install
```

### Configure in Claude Code

Add to your Claude Code MCP configuration (`~/.config/claude-code/mcp_servers.json`):

```json
{
  "tmux-terminal": {
    "command": "node",
    "args": ["/path/to/tmux-claude-bridge/mcp-server.js"],
    "cwd": "/path/to/tmux-claude-bridge"
  }
}
```

### Quick Start

1. **Start tmux session:**
   ```bash
   tmux new-session -s claude-work
   ```

2. **Launch Claude Code from within tmux:**
   ```bash
   claude-code
   ```

3. **Let Claude detect and set up your terminal:**
   - Claude will automatically detect your tmux environment
   - It will suggest creating a Claude Terminal if none exists
   - The CT Pane will be configured and ready for commands

## 🎮 Usage Examples

### First Time Setup
```
Claude: "🔍 Detected tmux session 'claude-work' with 1 pane"
Claude: "📋 No dedicated Claude Terminal found. Should I create one on the right?"
User: "yes"  
Claude: "✅ Created Claude Terminal (CT Pane) in pane 1. Ready for commands!"
```

### Command Execution Examples

**Quick Commands (≤5 seconds):**
```
User: "run ls -la"
Claude: "✅ ls -la completed in 0.8s:
total 48
drwxr-xr-x  12 user  staff   384 Aug 15 00:30 .
drwxr-xr-x   3 user  staff    96 Aug 14 23:45 ..
..."
```

**Long-Running Commands:**
```
User: "run npm install"  
Claude: "🔄 npm install started in Claude Terminal (pane 1)

Long-running command, switching to background monitoring.

Command ID: abc123-def456
Use get_command_status to check progress."

[Later automatically]
Claude: "✅ npm install completed in 3m 42s"
```

**Interactive Commands:**
```
User: "run sudo apt update"
Claude: "🔐 Sudo password required in Claude Terminal (pane 1). Focus switched for password entry."
```

### Background Command Monitoring
```
User: "get command status"
Claude: "📝 Active Commands (2):

🔹 npm run build
   ID: abc123-def456
   Status: running (2m 15s)

🔹 docker build -t myapp .
   ID: xyz789-uvw012  
   Status: completed (5m 32s)"
```

### File Structure
```
tmux-terminal-mcp/
├── package.json          # Dependencies and scripts
├── mcp-server.js         # Main MCP server implementation  
├── tmux-manager.js       # Tmux command utilities
├── command-detector.js   # Long-running command detection
├── test/                 # Test suite
└── README.md            # This file
```

### Key Components

- **TmuxManager**: Handles all tmux operations, CT Pane management, and command execution
- **CommandDetector**: Analyzes commands to determine execution strategy and special handling
- **MCP Server**: Implements the MCP protocol and coordinates between Claude and tmux

## 🧪 Testing

Run the test suite:
```bash
npm test
```

Test coverage includes:
- Output cleaning and ANSI sequence removal
- Shell prompt detection for command completion
- Interactive prompt identification
- Command analysis and categorization
- Timeout strategy determination

## 🔧 Advanced Configuration

### Environment Variables
- `TMUX_SESSION`: Override detected session name
- `DEBUG`: Enable debug logging
- `CT_PANE_TITLE`: Custom title for Claude Terminal pane

### Command Categories

The system recognizes these command categories:
- **package-manager**: npm, yarn, pip, brew, apt, etc.
- **build**: make, cmake, cargo, go build, etc.
- **container**: docker commands
- **testing**: pytest, jest, npm test, etc.
- **version-control**: git operations
- **file-system**: ls, find, cp, mv, etc.
- **network**: curl, wget, ssh, etc.
- **system**: ps, top, df, etc.

### Timeout Strategies
- **quick** (≤5s): `ls`, `pwd`, `git status`
- **extended** (≤30s): `git pull`, `npm run`, small builds
- **async** (background): `npm install`, `docker build`, large builds
- **no-timeout**: Interactive commands requiring user input

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass with `npm test`
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Troubleshooting

### "Not running in tmux session"
- Ensure you start Claude Code from within an active tmux session
- Check with `echo $TMUX` - should return a path

### "Failed to create Claude Terminal"  
- Make sure tmux has permission to create new panes
- Check if window layout allows horizontal splits

### Commands hanging
- Use `get_command_status` to check background commands
- Switch to CT Pane manually with `switch_terminal_focus`
- Use Ctrl+C in CT Pane to interrupt stuck commands

### Interactive prompts not detected
- The system looks for common patterns like "password:", "[y/n]", etc.
- You can manually switch focus with `switch_terminal_focus`

For more help, check the MCP server logs or create an issue in the repository.
