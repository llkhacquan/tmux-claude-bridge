# Implementation Request: Pure Node.js Tmux MCP

**Please implement a smart tmux MCP server in pure Node.js based on the following specifications:**

## Architecture
Create a single Node.js MCP server that communicates directly with tmux via shell commands (no Go binary needed):
```
Claude Code <--MCP Protocol--> Node.js MCP Server <--child_process--> tmux commands
```

## Core Concept: Claude Terminal (CT Pane)
Implement a "Claude Terminal" (CT Pane) - a dedicated tmux pane for Claude's command execution that provides clean separation between user's interactive work and Claude's automated tasks.

## Key Features to Implement

### 1. Intelligent Startup Behavior
- Detect if running inside tmux session (`tmux display-message -p '#S:#I.#P'`)
- Scan current window layout (`tmux list-panes`)
- CT Pane Discovery Logic:
  - If right pane exists: "✓ Found right pane - I'll use it as your Claude Terminal (CT Pane)"
  - If no right pane: "📋 Should I create a Claude Terminal pane for command execution?"
- Directory Sync: CT Pane should `cd` to Claude's current working directory on startup

### 2. Smart Execution Strategy: "Fire and Wait Briefly"
```javascript
// Pseudo-code for execution flow:
1. Send command to CT Pane via `tmux send-keys`
2. Wait 5 seconds and poll for completion
3. If completed ≤5s: Return output immediately 
4. If still running >5s: Switch to non-blocking mode, let user continue chatting
5. Auto-notify when long commands complete
```

### 3. Interactive Command Handling
- Detect interactive prompts (sudo passwords, confirmations, editors)
- Auto-switch focus to CT Pane: `tmux select-pane -t ${ctPaneId}`
- Never intercept sensitive input - delegate to user
- Handle scenarios: sudo prompts, git commit editors, interactive tools

### 4. MCP Tools to Expose
- `execute_terminal_command`: Main command execution in CT Pane
- `get_terminal_status`: Show CT Pane connection status
- `create_claude_terminal`: Create new CT Pane if needed
- `switch_terminal_focus`: Switch tmux focus to CT Pane
- `get_command_status`: Check status of running commands

## Technical Implementation Requirements

### Dependencies
```json
{
  "@modelcontextprotocol/sdk": "^1.0.0",
  "uuid": "^9.0.0"
}
```

### Key tmux Commands to Use
```bash
# Detect tmux environment
tmux display-message -p '#S:#I.#P'
tmux list-panes -F '#{pane_index}:#{pane_width}x#{pane_height}:#{pane_current_path}:#{pane_active}'

# CT Pane management  
tmux split-window -h -t ${session}
tmux select-pane -t ${paneId}
tmux send-keys -t ${paneId} '${command}' C-m
tmux capture-pane -t ${paneId} -p

# Directory sync
tmux send-keys -t ${paneId} "cd ${process.cwd()}" C-m
```

### Command Classification
Recognize long-running commands that need async handling:
- `npm install/ci`, `yarn install`
- `pip install`, `conda install`
- `docker build/pull`, `make`, `cargo build`
- `pytest`, `npm test`

## Expected User Experience

### First Time Setup
```
Claude: "🔍 Detected tmux session 'dev-work' with 2 panes"
Claude: "📋 No dedicated Claude Terminal found. Should I create one on the right? [y/n]"
User: "y"  
Claude: "✅ Created Claude Terminal (CT Pane) in pane 2. Ready for commands!"
```

### Command Execution Examples
```
User: "run ls -la"
Claude: [waits 1s] "✅ Command completed: [output]"

User: "run npm install"  
Claude: [waits 5s] "🔄 npm install running in CT Pane (5s+). Continue chatting!"
[Later] Claude: "✅ npm install completed (3m 42s)"

User: "run sudo apt update"
Claude: "🔐 Sudo password required in CT Pane. Please switch to pane 2"
Claude: [auto-switches focus to CT Pane]
```

## File Structure
```
tmux-terminal-mcp/
├── package.json
├── mcp-server.js        # Main MCP server implementation
├── tmux-manager.js      # Tmux command utilities
├── command-detector.js  # Long-running command detection
└── README.md
```

Please implement this as a complete, working MCP server with proper error handling, async command management, and the intelligent CT Pane behavior described above. Make it installable via standard MCP configuration in Claude Code.