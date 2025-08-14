# ⚡ Quick Start

**Get up and running with Tmux Terminal MCP in 3 minutes!**

## 🚀 1-Minute Install

```bash
# Prerequisites: Node.js 18+, tmux installed
git clone https://github.com/your-username/tmux-claude-bridge.git
cd tmux-claude-bridge
./setup.sh
```

## 🎯 2-Minute Configure

**Add to Claude Code MCP config** (`~/.config/claude-code/mcp_servers.json`):
```json
{
  "tmux-terminal": {
    "command": "node",
    "args": ["/path/to/tmux-claude-bridge/mcp-server.js"],
    "cwd": "/path/to/tmux-claude-bridge"
  }
}
```

## 🏃 3-Minute Run

```bash
# Start tmux session
tmux new-session -s work

# Launch Claude Code from within tmux
claude-code
```

Claude will auto-detect tmux and guide you through CT Pane setup!

---

## 💡 First Commands to Try

```
"create a Claude Terminal pane"
"run ls -la"  
"run npm install"
"get terminal status"
"switch to terminal focus"
```

## 🎯 Key Concepts

- **CT Pane** = Claude Terminal = Dedicated pane for Claude's commands
- **"Fire and Wait Briefly"** = Quick commands return immediately, long commands run in background
- **Smart Focus** = Claude automatically switches to terminal when you need to interact

---

**Need help?** See [INSTALL.md](./INSTALL.md) for detailed setup or [README.md](./README.md) for comprehensive usage guide.