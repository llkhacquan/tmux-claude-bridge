# Claude Integration Guide

This document provides detailed instructions for integrating the tmux-claude-bridge with Claude Code as a Multi-Context Proxy (MCP) server.

## Overview

The tmux-claude-bridge acts as an MCP server that exposes terminal execution capabilities to Claude Code. This allows Claude to:

- Execute commands in your local terminal
- Receive real-time output from command execution
- Work with your local development environment seamlessly

## Architecture

```
┌──────────────┐    MCP Protocol    ┌─────────────────┐    WebSocket    ┌─────────────────┐    tmux    ┌─────────┐
│  Claude Code │ ─────────────────► │   MCP Server    │ ──────────────► │  Bridge Server  │ ─────────► │  tmux   │
│              │                    │   (Terminal)    │                 │   (WebSocket)   │            │  pane   │
└──────────────┘                    └─────────────────┘                 └─────────────────┘            └─────────┘
```

## MCP Server Implementation

The MCP server acts as a proxy between Claude Code and the WebSocket bridge. Here's the complete implementation:

### 1. Create MCP Server

Create a file `mcp-terminal-server.js`:

```javascript
#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

class TerminalMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "tmux-terminal-bridge",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.ws = null;
    this.pendingCommands = new Map();
    this.setupHandlers();
    this.connectWebSocket();
  }

  connectWebSocket() {
    try {
      this.ws = new WebSocket('ws://localhost:8080/ws');
      
      this.ws.on('open', () => {
        console.error('Connected to tmux bridge');
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      this.ws.on('close', () => {
        console.error('WebSocket connection closed');
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.connectWebSocket(), 5000);
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      // Attempt to reconnect after 5 seconds
      setTimeout(() => this.connectWebSocket(), 5000);
    }
  }

  handleWebSocketMessage(message) {
    if (!message.id) return;

    const promise = this.pendingCommands.get(message.id);
    if (!promise) return;

    switch (message.type) {
      case 'output':
        if (message.status === 'complete') {
          promise.resolve({
            content: [
              {
                type: "text",
                text: `Command executed successfully:\n\n${message.output}`,
              },
            ],
          });
          this.pendingCommands.delete(message.id);
        } else if (message.status === 'timeout') {
          promise.resolve({
            content: [
              {
                type: "text", 
                text: `Command timed out. Partial output:\n\n${message.output}`,
              },
            ],
          });
          this.pendingCommands.delete(message.id);
        }
        // For 'running' status, we could optionally send intermediate updates
        break;

      case 'error':
        promise.reject(new Error(message.error));
        this.pendingCommands.delete(message.id);
        break;

      case 'status':
        if (message.status === 'connected') {
          console.error('Bridge connection established');
        }
        break;
    }
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "execute_terminal_command",
            description: "Execute a command in the terminal and return its output. The command will be executed in a tmux pane.",
            inputSchema: {
              type: "object",
              properties: {
                command: {
                  type: "string",
                  description: "The terminal command to execute",
                },
              },
              required: ["command"],
            },
          },
          {
            name: "get_terminal_status", 
            description: "Get the status of the terminal bridge connection",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "execute_terminal_command":
          return this.executeCommand(args.command);
        
        case "get_terminal_status":
          return this.getStatus();

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async executeCommand(command) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket connection is not available. Ensure the tmux-claude-bridge server is running.");
    }

    const id = uuidv4();
    
    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(id);
        reject(new Error("Command execution timed out"));
      }, 60000); // 60 second timeout

      this.pendingCommands.set(id, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      // Send command to bridge
      this.ws.send(JSON.stringify({
        type: 'execute',
        command: command,
        id: id
      }));
    });
  }

  async getStatus() {
    const isConnected = this.ws && this.ws.readyState === WebSocket.OPEN;
    
    return {
      content: [
        {
          type: "text",
          text: `Terminal Bridge Status:
- WebSocket Connection: ${isConnected ? 'Connected' : 'Disconnected'}
- Bridge URL: ws://localhost:8080/ws
- Pending Commands: ${this.pendingCommands.size}`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("tmux-terminal-bridge MCP server running on stdio");
  }
}

const server = new TerminalMCPServer();
server.run().catch(console.error);
```

### 2. Create package.json

Create `package.json` for the MCP server:

```json
{
  "name": "tmux-terminal-bridge-mcp",
  "version": "1.0.0",
  "description": "MCP server for tmux terminal bridge",
  "type": "module",
  "main": "mcp-terminal-server.js",
  "bin": {
    "tmux-terminal-bridge-mcp": "./mcp-terminal-server.js"
  },
  "scripts": {
    "start": "node mcp-terminal-server.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "ws": "^8.16.0",
    "uuid": "^9.0.0"
  },
  "keywords": ["mcp", "terminal", "tmux", "claude"],
  "author": "Your Name",
  "license": "MIT"
}
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Make the server executable

```bash
chmod +x mcp-terminal-server.js
```

## Claude Code Configuration

### Option 1: Global Configuration

Add to your global Claude Code configuration (`~/.claude/config.json`):

```json
{
  "mcpServers": {
    "tmux-terminal": {
      "command": "node",
      "args": ["/path/to/your/mcp-terminal-server.js"]
    }
  }
}
```

### Option 2: Project-specific Configuration

Create a `.claude/config.json` in your project root:

```json
{
  "mcpServers": {
    "tmux-terminal": {
      "command": "node", 
      "args": ["./mcp-terminal-server.js"]
    }
  }
}
```

### Option 3: Using npx (if published)

```json
{
  "mcpServers": {
    "tmux-terminal": {
      "command": "npx",
      "args": ["tmux-terminal-bridge-mcp"]
    }
  }
}
```

## Setup Workflow

### 1. Start the Bridge Server

```bash
# Terminal 1: Start the Go WebSocket bridge
./tmux-claude-bridge
```

### 2. Set up tmux Session

```bash
# Terminal 2: Create tmux session
tmux new-session -d -s claude-bridge
tmux split-window -h -t claude-bridge
```

### 3. Start Claude Code

```bash
# Terminal 3: Start Claude Code (in the directory with MCP server)
claude-code
```

### 4. Test the Integration

In Claude Code, you can now use commands like:

```
Execute the command "ls -la" in the terminal
```

Claude will use the `execute_terminal_command` tool to run the command in your tmux pane.

## Usage Examples

### Basic Commands

**User**: "List the files in the current directory"

**Claude**: *Uses execute_terminal_command with "ls -la"*

**User**: "Check if Node.js is installed"

**Claude**: *Uses execute_terminal_command with "node --version"*

### Development Workflows

**User**: "Install the project dependencies"

**Claude**: *Uses execute_terminal_command with "npm install"*

**User**: "Run the tests"

**Claude**: *Uses execute_terminal_command with "npm test"*

### System Administration

**User**: "Check system memory usage"

**Claude**: *Uses execute_terminal_command with "free -h"*

**User**: "See what processes are running"

**Claude**: *Uses execute_terminal_command with "ps aux"*

## Advanced Configuration

### Custom Bridge URL

Modify the MCP server to use a different bridge URL:

```javascript
this.ws = new WebSocket('ws://localhost:9999/ws');
```

### Command Filtering

Add security by filtering allowed commands:

```javascript
executeCommand(command) {
  const allowedCommands = ['ls', 'pwd', 'cat', 'grep', 'find'];
  const firstWord = command.split(' ')[0];
  
  if (!allowedCommands.includes(firstWord)) {
    throw new Error(`Command '${firstWord}' is not allowed`);
  }
  
  // Continue with execution...
}
```

### Environment Variables

Support environment variables in the MCP server:

```javascript
const BRIDGE_URL = process.env.TMUX_BRIDGE_URL || 'ws://localhost:8080/ws';
const TIMEOUT = parseInt(process.env.COMMAND_TIMEOUT) || 60000;
```

## Troubleshooting

### MCP Server Issues

1. **"WebSocket connection is not available"**
   - Ensure the Go bridge server is running on port 8080
   - Check that the bridge server shows "Starting tmux-claude-bridge server"

2. **"Command execution timed out"**
   - Increase timeout in the MCP server
   - Check if the command is hanging in the tmux pane

3. **MCP server not connecting to Claude Code**
   - Verify the path to `mcp-terminal-server.js` in configuration
   - Check Claude Code logs for MCP server connection errors

### Bridge Server Issues

1. **"tmux session not found"**
   - Create the tmux session: `tmux new-session -d -s claude-bridge`
   - Verify session name in bridge configuration

2. **Commands not executing**
   - Check if tmux pane is responsive
   - Ensure no interactive programs are blocking the pane

### Integration Issues

1. **Claude not using terminal commands**
   - Restart Claude Code after adding MCP configuration
   - Check if the `execute_terminal_command` tool is listed with `/tools`

2. **Partial output received**
   - The bridge uses command completion detection
   - For commands without clear prompts, output might be truncated

## Security Considerations

- **Local Network Only**: Ensure the bridge only binds to localhost
- **Command Validation**: Implement allowed command lists for security
- **Session Isolation**: Use dedicated tmux sessions for Claude interactions  
- **Resource Limits**: Set appropriate timeouts to prevent resource exhaustion
- **Audit Logging**: Consider logging all executed commands for security audits

## Best Practices

1. **Dedicated tmux Session**: Always use a separate tmux session for Claude
2. **Regular Monitoring**: Monitor the bridge server logs for any issues
3. **Graceful Degradation**: Handle WebSocket disconnections gracefully
4. **Error Reporting**: Provide clear error messages to Claude
5. **Resource Cleanup**: Clean up pending commands on disconnection

## Performance Considerations

- **Command Concurrency**: The bridge can handle multiple commands concurrently
- **Output Buffering**: Large outputs are streamed efficiently
- **Memory Usage**: Monitor memory usage with long-running commands
- **Network Overhead**: WebSocket provides low-latency communication

This integration enables powerful collaboration between Claude and your local development environment while maintaining security and performance.