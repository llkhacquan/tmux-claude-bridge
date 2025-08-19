# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **tmux-terminal-mcp** - a pure Node.js MCP (Model Context Protocol) server that provides intelligent tmux terminal management for Claude Code. The core concept is the **Claude Terminal (CT Pane)** with "Fire and Wait Briefly" execution strategy.

## Key Architecture Components

### Core Files Structure
- `mcp-server.js` - Main MCP server implementation, handles tool registration and Claude communication
- `tmux-manager.js` - Core tmux operations, CT Pane management, and command execution
- `command-detector.js` - Analyzes commands to determine execution strategy (quick/long-running/interactive)
- `help-loader.js` - Loads contextual help content from help-content/ directory
- `help-content/` - Directory containing markdown help files for different scenarios

### MCP Tools Provided
The server exposes these tools to Claude:
- `execute_terminal_command` - Execute commands with intelligent timeout handling
- `get_terminal_status` - Show CT Pane and tmux environment status  
- `create_claude_terminal` - Create new CT Pane if needed
- `switch_terminal_focus` - Switch tmux focus to CT Pane
- `get_command_status` - Check status of running background commands

## Command Execution Strategy

### "Fire and Wait Briefly" Pattern
1. Send command to CT Pane immediately via `tmux send-keys`
2. Wait up to 5 seconds for quick command completion
3. If completed ≤5s: return output immediately
4. If running >5s: switch to background monitoring mode

### Command Categories
Commands are classified by the CommandDetector:
- **Quick commands** (≤5s): `ls`, `pwd`, `git status`
- **Extended commands** (≤30s): `git pull`, small builds
- **Long-running commands** (async): `npm install`, `docker build`, large compilations
- **Interactive commands**: require user input (sudo, editors, REPLs)

## Development Commands

### Essential Commands
```bash
# Run tests
npm test

# Lint code  
npm run lint

# Format code
npm run format

# Start MCP server
npm start

# Debug mode
npm run dev
```

### Testing
- Tests are in `test/` directory using Node.js built-in test runner
- Run with `node --test test/*.test.js` 
- Tests cover output cleaning, prompt detection, command analysis

## Key Implementation Details

### TmuxManager Class
- Manages tmux session detection and pane operations
- Handles CT Pane creation, discovery, and command execution
- Implements output cleaning and ANSI sequence removal
- Manages background command monitoring

### CommandDetector Class  
- Pattern-based recognition of command types
- Determines appropriate timeout strategies
- Identifies interactive commands requiring user delegation
- Categorizes commands by tool type (package-manager, build, container, etc.)

### Security Model
- Never intercepts or processes sensitive input (passwords, tokens)
- Delegates interactive prompts to user by switching tmux focus
- Claude Terminal provides clean separation from user's interactive work

## CT Pane Management

### Auto-Detection Logic
1. Detect if running in tmux session
2. Scan window layout for existing panes
3. Check for right pane as default CT Pane candidate
4. Offer to create new pane if none suitable found

### Pane Selection Strategy
- Prefers right pane in horizontal layout
- Falls back to any available pane
- Creates new pane if user consents
- Maintains connection state across operations

## Output Handling

### Large Output Management
- Auto-detects potentially large outputs
- Implements truncation strategies for massive command outputs
- Offers options: show last N lines, save to file, or summarize
- Prevents Claude context overflow from verbose commands

### Output Cleaning
- Removes ANSI color codes and control sequences
- Detects shell prompts to determine command completion
- Strips tmux-specific formatting artifacts
- Preserves essential command output structure

## Interactive Command Patterns

Commands requiring user interaction are detected by patterns:
- Sudo password prompts: `/password.*:/i`
- Confirmation prompts: `/\[y\/n\]/i`, `/continue\?/i`  
- Editor launches: `git commit`, `crontab -e`
- Interactive tools: `htop`, `top`, `vim`, `nano`

When detected, the system switches tmux focus to CT Pane and delegates control to user.

## Environment Variables

- `TMUX_SESSION` - Override detected session name
- `DEBUG` - Enable debug logging 
- `CT_PANE_TITLE` - Custom title for Claude Terminal pane

## Installation Considerations

Must be run from within an active tmux session. The MCP server needs tmux context to operate. Supports both npm global installation and local development setup.