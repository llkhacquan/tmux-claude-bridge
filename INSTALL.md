# Installation & Setup Guide

Step-by-step guide to install and configure the Tmux Terminal MCP for Claude.

## 📋 Prerequisites

Before installing, ensure you have:

- **Node.js 18+** installed
- **tmux** installed and working
- **Claude** installed and configured

### Quick Prerequisites Check

```bash
# Check Node.js version (should be 18+)
node --version

# Check tmux installation
tmux -V

# Check Claude installation
clause --version
```

## 🚀 Installation Steps

### Step 1: Download and Install

```bash
# Clone the repository
git clone https://github.com/your-username/tmux-claude-bridge.git
cd tmux-claude-bridge

# Install dependencies
npm install

# Verify installation
npm test
```

### Step 2: Configure Claude

Add the MCP server to your Claude configuration:

**Manual Configuration:**

1. Open your MCP configuration file:
   ```bash
   # macOS/Linux
   vi ~/.config/clause/mcp_servers.json
   
   # Windows
   notepad %APPDATA%\clause\mcp_servers.json
   ```

2. Add the tmux-terminal MCP:
   ```json
   {
     "tmux-terminal": {
       "command": "node",
       "args": ["/absolute/path/to/tmux-claude-bridge/mcp-server.js"],
       "cwd": "/absolute/path/to/tmux-claude-bridge"
     }
   }
   ```

### Step 3: Test Installation

```bash
# Start tmux session
tmux new-session -s test-claude

# In the tmux session, start Claude
clause

# Verify MCP is loaded (check Claude startup logs)
# You should see: "🚀 Tmux Terminal MCP Server running"
```

## ⚡ Quick Start

### 1. Start Your Development Environment

```bash
# Create a tmux session for your project
tmux new-session -s myproject

# Navigate to your project
cd /path/to/your/project

# Launch Claude from within tmux
clause
```

### 2. Initial Setup with Claude

Once Claude starts, the MCP will automatically:

1. **Detect tmux environment**:
   ```
   Claude: "🔍 Detected tmux session 'myproject' with 1 pane"
   ```

2. **Suggest CT Pane creation**:
   ```
   Claude: "📋 No dedicated Claude Terminal found. Should I create one?"
   ```

3. **Create and configure CT Pane**:
   ```
   User: "yes"
   Claude: "✅ Created Claude Terminal (CT Pane) in pane 1. Ready for commands!"
   ```

### 3. Start Using Commands

```
User: "run ls -la"
Claude: "✅ ls -la completed in 0.3s: [output]"

User: "run npm install"
Claude: "🔄 npm install started in CT Pane. This may take a while..."
```

## 🛠 Configuration Options

### Environment Variables

Set these before starting Claude Code:

```bash
# Override session detection
export TMUX_SESSION=myproject

# Enable debug logging
export DEBUG=1

# Custom CT Pane title
export CT_PANE_TITLE="Claude AI Terminal"
```

### Advanced Configuration

Create a `config.json` file in the project directory:

```json
{
  "defaultSession": "development",
  "panePosition": "right",
  "commandTimeout": 300,
  "autoCreatePane": true,
  "logLevel": "info"
}
```

## 🔧 Troubleshooting Installation

### Common Installation Issues

**1. "Module not found" errors**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**2. "Permission denied" on mcp-server.js**
```bash
chmod +x mcp-server.js
```

**3. Claude can't find MCP**
```bash
# Verify absolute paths in configuration
# Check Claude logs for MCP errors
clause --debug
```

### Verification Commands

```bash
# Test MCP server syntax
node --check mcp-server.js

# Test all modules
npm test

# Test tmux integration (requires tmux session)
echo $TMUX  # Should show tmux socket path
tmux list-sessions  # Should show your sessions
```

## 📁 Directory Structure After Installation

```
tmux-claude-bridge/
├── package.json          # Node.js dependencies
├── mcp-server.js         # Main MCP server (executable)
├── tmux-manager.js       # Tmux operations module
├── command-detector.js   # Command analysis module
├── test/                 # Test suite
│   └── basic.test.js
├── README.md            # Complete documentation
├── INSTALL.md          # This installation guide
└── node_modules/       # Dependencies (after npm install)
```

## 🚦 Validation Checklist

After installation, verify everything works:

- [ ] Node.js 18+ installed
- [ ] tmux installed and working
- [ ] Repository cloned and dependencies installed
- [ ] Tests pass with `npm test`
- [ ] MCP configuration added to Claude
- [ ] Can start tmux session
- [ ] Claude starts from within tmux
- [ ] MCP server initializes (check logs)
- [ ] Can create CT Pane when prompted
- [ ] Can execute basic commands like `ls`

## 🆘 Getting Help

If you encounter issues:

1. **Check the logs**: Claude shows MCP startup messages
2. **Verify tmux**: Ensure you're running Claude from within tmux
3. **Test components**: Use `npm test` to verify core functionality
4. **Check permissions**: Ensure mcp-server.js is executable
5. **Review paths**: Verify absolute paths in MCP configuration

### Debug Mode

Run with verbose logging:

```bash
# In your tmux session
DEBUG=1 clause
```

This will show detailed MCP communication and tmux operations.

## 🔄 Updating

To update the MCP server:

```bash
cd tmux-claude-bridge
git pull origin main
npm install
npm test
```

Restart Claude to load the updated version.

---

**Next Steps**: Once installed, see [README.md](./README.md) for comprehensive usage examples and advanced features!