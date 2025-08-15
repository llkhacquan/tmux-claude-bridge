# Tmux Terminal MCP

A pure Node.js MCP (Model Context Protocol) server that provides intelligent tmux terminal management for Claude. Features the innovative **Claude Terminal (CT Pane)** concept with "Fire and Wait Briefly" execution strategy.

## 📦 Quick Install

```bash
npm install -g tmux-terminal-mcp
```

Then add to your Claude MCP configuration (`~/.config/clause/mcp_servers.json`):

```json
{
  "tmux-terminal": {
    "command": "tmux-terminal-mcp"
  }
}
```

## 🎯 Core Concept: Claude Terminal (CT Pane)

The **Claude Terminal** is a dedicated tmux pane for Claude's command execution, providing clean separation between your interactive work and Claude's automated tasks. This prevents command interference and gives you full control over both environments.

## ✨ Key Features

### 🔔 Zero-Setup Auto-Announcement
- Automatically announces itself to Claude when MCP loads
- Claude immediately knows about shared terminal capabilities
- No manual setup or commands required from user
- Triggers permission request on first use

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

### Configure in Claude

Add to your Claude MCP configuration (`~/.config/clause/mcp_servers.json`):

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

2. **Launch Claude from within tmux:**
   ```bash
   clause
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
- Ensure you start Claude from within an active tmux session
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

## 📋 Comprehensive Use Cases

### 🎯 Claude Terminal (CT Pane) Concept

The **Claude Terminal** is a dedicated tmux pane for Claude's command execution, providing clean separation between your interactive work and Claude's automated tasks.

### 🧠 Intelligent Startup Behavior

When Claude starts with the tmux MCP:

1. **Tmux Detection**: Automatically detects if running inside a tmux session
2. **Pane Analysis**: Scans current window layout to identify available panes
3. **CT Pane Discovery**: 
   - If a right pane exists: "✓ Found right pane - I'll use it as your Claude Terminal (CT Pane)"
   - If no right pane exists: "📋 No right pane found. Should I create a Claude Terminal pane for command execution?"
4. **Connection Status**: Displays which pane is currently connected as the CT Pane

### 🎛️ Interactive Pane Management

- **Smart Pane Creation**: 
  ```
  Claude: "I need a dedicated terminal. Create Claude Terminal pane?"
  User: "yes" → Creates right pane and designates it as CT Pane
  ```
- **Flexible Target Selection**: 
  ```
  Claude: "Multiple panes detected. Which should be the Claude Terminal?"
  User: "pane 2" → Connects to pane 2 as CT Pane
  ```
- **Dynamic Reconnection**: 
  ```
  Claude: "CT Pane disconnected. Reconnecting to available pane..."
  ```

### ⚡ "Fire and Wait Briefly" Execution Strategy

**Execution Flow:**
1. **Send Command**: Execute command in CT Pane immediately
2. **Brief Wait**: Monitor for 5 seconds for quick completion
3. **Quick Response**: If command completes ≤5s, return output immediately
4. **Async Mode**: If still running >5s, switch to non-blocking mode

**Quick Commands (≤5s)**
```
User: "run ls -la"
Claude: [waits 1s] "✅ Command completed:
total 48
drwxr-xr-x  8 user  staff   256 Jan 14 10:30 .
-rw-r--r--  1 user  staff  1234 Jan 14 10:30 package.json"
```

**Long Commands (>5s)**  
```
User: "run npm install"
Claude: [waits 5s, still running] "🔄 npm install is running in CT Pane (5s+)"
Claude: "Continue our conversation - I'll notify you when it's done!"

User: "what dependencies will be installed?"
Claude: "Based on your package.json, npm will install react, express..." 
[Meanwhile npm continues running in CT Pane]

[Later...]
Claude: "✅ npm install completed successfully (took 3m 42s)"
```

**Smart Command Classification:**
- `npm install/ci`, `yarn install`
- `pip install`, `conda install` 
- `docker build`, `docker pull`
- `make`, `cargo build`, `go build`
- `pytest`, `npm test`

### 🔒 Interactive Command Handling

The MCP handles interactive commands by delegating user input while maintaining security:

**Sudo Password Prompts**
```
User: "run sudo apt update"
Claude: [sends command, detects password prompt]
Claude: "🔐 Sudo password required in CT Pane"
Claude: "Please switch to pane 2 and enter your password"
Claude: [automatically executes: tmux select-pane -t 2]
```

**Text Editors**
```
User: "run git commit"
Claude: "📝 Git editor opened in CT Pane"  
Claude: [executes: tmux select-pane -t 2]
Claude: "Complete your commit message, then switch back to continue"
```

**Interactive Tools**
```
User: "run htop"
Claude: "🔧 Interactive tool 'htop' launched in CT Pane"
Claude: [executes: tmux select-pane -t 2]
Claude: "CT Pane control released. Exit htop to resume normal operation"
```

**Security Benefits:**
- **Zero Password Exposure**: Claude never accesses or processes sensitive input
- **Direct User Control**: User maintains complete control over authentication
- **Clean Separation**: Clear boundary between automated and interactive operations

### 📊 Large Output Management

Commands can generate massive outputs that exceed Claude's processing capabilities:

**Problem Commands:**
- `docker logs container` (thousands of log lines)
- `npm install --verbose` (extremely detailed logs)
- `find / -name "*.log"` (system-wide searches)
- `cat large-file.json` (multi-megabyte files)

**Smart Output Strategies:**

**Preemptive Output Control**
```
User: "show me the docker logs"
Claude: "📊 Docker logs detected - potentially large output"
Claude: "Options:"
Claude: "1. Show last 50 lines (recommended)"
Claude: "2. Show full output (may be truncated)"
Claude: "3. Save to file for review"
```

**Auto-Truncation with User Choice**
```
User: "run npm install --verbose"
Claude: [detects massive output during execution]
Claude: "⚠️ Command output is very large (15,000+ lines)"
Claude: "I can only process the last 100 lines. Should I:"
Claude: "1. Clear CT Pane and show summary"
Claude: "2. Show last 100 lines only" 
Claude: "3. Save full output to file"
```

**Smart Output Summarization**
```
Claude: "📝 Large output detected from 'npm install --verbose'"
Claude: "Summary extracted:"
Claude: "✅ 2,847 packages installed successfully" 
Claude: "⚠️ 3 warnings (peer dependency issues)"
Claude: "✅ Build completed in 4m 32s"
Claude: "📁 Full output saved to: /tmp/claude-npm-install-20240814.log"
```

### 🎪 User Experience Scenarios

**Scenario 1: First Time Setup**
```
Claude: "🔍 Detected tmux session 'dev-work' with 2 panes"
Claude: "📋 No dedicated Claude Terminal found. Should I create one on the right? [y/n]"
User: "y"
Claude: "✅ Created Claude Terminal (CT Pane) in pane 2. Ready for commands!"
```

**Scenario 2: Existing Layout**
```
Claude: "✓ Connected to existing Claude Terminal (pane 1)"
Claude: "📁 CT Pane location: /Users/dev/project"
Claude: "Ready to execute commands in your dedicated terminal space."
```

**Scenario 3: Layout Changes**
```
Claude: "⚠️ CT Pane (pane 2) was closed. Available panes: 0, 1, 3"
Claude: "Should I use pane 3 as the new Claude Terminal?"
```
