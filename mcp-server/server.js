#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Smart Tmux MCP Server
 * 
 * Provides intelligent tmux integration with Claude Terminal (CT Pane) concept.
 * Features:
 * - Automatic tmux session and pane detection
 * - Smart pane creation and management
 * - Interactive pane selection and configuration
 * - Session intelligence with layout monitoring
 * - Context-aware command execution
 */
class SmartTmuxMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "smart-tmux-bridge",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Connection and state management
    this.ws = null;
    this.pendingCommands = new Map();
    this.bridgeUrl = process.env.TMUX_BRIDGE_URL || 'ws://localhost:8080/ws';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;

    // Smart tmux state
    this.currentSession = null;
    this.ctPane = null; // Claude Terminal pane
    this.availablePanes = [];
    this.sessionLayout = null;
    this.isInTmux = false;

    // Initialize
    this.setupHandlers();
    this.initializeTmuxState();
    this.connectWebSocket();
  }

  /**
   * Initialize tmux state detection
   */
  async initializeTmuxState() {
    try {
      // Detect if running inside tmux
      this.isInTmux = !!process.env.TMUX;
      
      // Get current session if in tmux
      if (this.isInTmux) {
        this.currentSession = process.env.TMUX_SESSION || await this.getCurrentTmuxSession();
      } else {
        // Find available sessions
        this.currentSession = await this.findBestTmuxSession();
      }

      if (this.currentSession) {
        await this.analyzeTmuxLayout();
        await this.detectClaudeTerminal();
      }
    } catch (error) {
      this.logError('Failed to initialize tmux state:', error);
    }
  }

  /**
   * Get current tmux session name
   */
  async getCurrentTmuxSession() {
    try {
      const { stdout } = await execAsync('tmux display-message -p "#S"');
      return stdout.trim();
    } catch (error) {
      return null;
    }
  }

  /**
   * Find the best tmux session to use
   */
  async findBestTmuxSession() {
    try {
      // First try claude-bridge session
      const { stdout } = await execAsync('tmux list-sessions -F "#{session_name}"');
      const sessions = stdout.trim().split('\n').filter(s => s);
      
      // Prefer claude-bridge session
      if (sessions.includes('claude-bridge')) {
        return 'claude-bridge';
      }
      
      // Otherwise use the first available session
      return sessions[0] || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Analyze current tmux window layout
   */
  async analyzeTmuxLayout() {
    if (!this.currentSession) return;

    try {
      // Get window info
      const { stdout: windowInfo } = await execAsync(
        `tmux list-windows -t "${this.currentSession}" -F "#{window_index}:#{window_name}:#{window_panes}"`
      );
      
      // Get pane info for current window
      const { stdout: paneInfo } = await execAsync(
        `tmux list-panes -t "${this.currentSession}" -F "#{pane_index}:#{pane_title}:#{pane_width}x#{pane_height}:#{pane_active}:#{pane_current_path}"`
      );

      this.availablePanes = paneInfo.trim().split('\n').map(line => {
        const [index, title, dimensions, active, path] = line.split(':');
        return {
          index: parseInt(index),
          title,
          dimensions,
          active: active === '1',
          path,
          isBusy: false // Will be detected later
        };
      });

      this.sessionLayout = {
        session: this.currentSession,
        windows: windowInfo.trim().split('\n').map(line => {
          const [index, name, paneCount] = line.split(':');
          return { index: parseInt(index), name, paneCount: parseInt(paneCount) };
        }),
        panes: this.availablePanes
      };
    } catch (error) {
      this.logError('Failed to analyze tmux layout:', error);
    }
  }

  /**
   * Detect or assign Claude Terminal pane
   */
  async detectClaudeTerminal() {
    if (!this.availablePanes.length) return;

    // Strategy 1: Look for existing CT pane by title
    let ctPane = this.availablePanes.find(pane => 
      pane.title && pane.title.toLowerCase().includes('claude') ||
      pane.title && pane.title.toLowerCase().includes('terminal')
    );

    // Strategy 2: Use right pane (index 1) if available
    if (!ctPane && this.availablePanes.length > 1) {
      ctPane = this.availablePanes.find(pane => pane.index === 1);
    }

    // Strategy 3: Use the last pane
    if (!ctPane) {
      ctPane = this.availablePanes[this.availablePanes.length - 1];
    }

    if (ctPane) {
      this.ctPane = ctPane;
      this.logInfo(`📍 Claude Terminal detected: pane ${ctPane.index} (${ctPane.title || 'unnamed'})`);
    }
  }

  /**
   * Create a new Claude Terminal pane
   */
  async createClaudeTerminal() {
    if (!this.currentSession) {
      throw new Error('No tmux session available');
    }

    try {
      // Split current window horizontally to create right pane
      await execAsync(`tmux split-window -h -t "${this.currentSession}"`);
      
      // Set pane title
      const newPaneIndex = this.availablePanes.length;
      await execAsync(`tmux select-pane -t "${this.currentSession}:${newPaneIndex}" -T "Claude Terminal"`);
      
      // Send welcome message
      await execAsync(`tmux send-keys -t "${this.currentSession}:${newPaneIndex}" 'echo "🤖 Claude Terminal (CT Pane) - Ready for command execution"' Enter`);
      
      // Update our state
      await this.analyzeTmuxLayout();
      await this.detectClaudeTerminal();
      
      return this.ctPane;
    } catch (error) {
      throw new Error(`Failed to create Claude Terminal: ${error.message}`);
    }
  }

  /**
   * Get tmux session status for display
   */
  async getTmuxStatus() {
    const status = {
      inTmux: this.isInTmux,
      currentSession: this.currentSession,
      ctPane: this.ctPane,
      availablePanes: this.availablePanes,
      sessionLayout: this.sessionLayout,
      bridgeConnected: this.ws && this.ws.readyState === WebSocket.OPEN
    };

    return status;
  }

  /**
   * Setup MCP request handlers
   */
  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "execute_command",
            description: "Execute a command in the Claude Terminal (CT Pane). Commands are automatically routed to the designated tmux pane.",
            inputSchema: {
              type: "object",
              properties: {
                command: {
                  type: "string",
                  description: "The command to execute in the Claude Terminal",
                },
              },
              required: ["command"],
            },
          },
          {
            name: "execute_in_pane",
            description: "Execute a command in a specific tmux pane by index.",
            inputSchema: {
              type: "object",
              properties: {
                pane: {
                  type: "number",
                  description: "The pane index to execute the command in",
                },
                command: {
                  type: "string",
                  description: "The command to execute",
                },
              },
              required: ["pane", "command"],
            },
          },
          {
            name: "get_tmux_status",
            description: "Get detailed status of tmux session, panes, and Claude Terminal configuration.",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "setup_claude_terminal",
            description: "Create or reconfigure the Claude Terminal pane for command execution.",
            inputSchema: {
              type: "object",
              properties: {
                pane: {
                  type: "number",
                  description: "Specific pane index to use as Claude Terminal (optional)",
                },
                create: {
                  type: "boolean",
                  description: "Create a new pane if true (default: false)",
                },
              },
            },
          },
          {
            name: "list_tmux_sessions",
            description: "List all available tmux sessions and their layouts.",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "switch_session",
            description: "Switch to a different tmux session.",
            inputSchema: {
              type: "object",
              properties: {
                session: {
                  type: "string",
                  description: "Session name to switch to",
                },
              },
              required: ["session"],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "execute_command":
            return await this.executeCommand(args.command);
          
          case "execute_in_pane":
            return await this.executeInPane(args.pane, args.command);
          
          case "get_tmux_status":
            return await this.getStatusReport();
          
          case "setup_claude_terminal":
            return await this.setupClaudeTerminal(args.pane, args.create);
          
          case "list_tmux_sessions":
            return await this.listTmuxSessions();
          
          case "switch_session":
            return await this.switchSession(args.session);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error executing ${name}: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Execute command in Claude Terminal
   */
  async executeCommand(command) {
    // Ensure we have a CT pane
    if (!this.ctPane) {
      await this.detectClaudeTerminal();
      if (!this.ctPane) {
        return {
          content: [
            {
              type: "text",
              text: `🔍 No Claude Terminal found. Available panes: ${this.availablePanes.map(p => p.index).join(', ')}\n\nWould you like me to create a Claude Terminal pane or specify which pane to use?`,
            },
          ],
        };
      }
    }

    return await this.executeInPane(this.ctPane.index, command, true);
  }

  /**
   * Execute command in specific pane
   */
  async executeInPane(paneIndex, command, isCtPane = false) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Try to reconnect
      await this.connectWebSocket();
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        throw new Error("Bridge connection not available. Ensure tmux-claude-bridge server is running.");
      }
    }

    // Update bridge configuration for the target pane
    const targetSession = this.currentSession || 'claude-bridge';
    process.env.TMUX_SESSION = targetSession;
    process.env.TMUX_PANE = paneIndex.toString();

    const id = uuidv4();
    const prefix = isCtPane ? `CT Pane (${paneIndex})` : `Pane ${paneIndex}`;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(id);
        reject(new Error("Command execution timed out"));
      }, 60000);

      this.pendingCommands.set(id, {
        resolve: (result) => {
          clearTimeout(timeout);
          // Add execution context to result
          if (result.content && result.content[0]) {
            result.content[0].text = `📍 Executed in ${prefix}: ${command}\n\n${result.content[0].text}`;
          }
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      this.ws.send(JSON.stringify({
        type: 'execute',
        command: command,
        id: id
      }));
    });
  }

  /**
   * Get comprehensive status report
   */
  async getStatusReport() {
    await this.analyzeTmuxLayout();
    const status = await this.getTmuxStatus();
    
    let report = "🔍 **Smart Tmux MCP Status Report**\n\n";
    
    // Connection status
    report += `**Bridge Connection:** ${status.bridgeConnected ? '✅ Connected' : '❌ Disconnected'}\n`;
    report += `**Bridge URL:** ${this.bridgeUrl}\n\n`;
    
    // Tmux environment
    if (status.inTmux) {
      report += `**Environment:** Running inside tmux session\n`;
    } else {
      report += `**Environment:** External tmux control\n`;
    }
    
    report += `**Active Session:** ${status.currentSession || 'None detected'}\n\n`;
    
    // Claude Terminal status
    if (status.ctPane) {
      report += `**Claude Terminal (CT Pane):** ✅ Configured\n`;
      report += `  - Pane Index: ${status.ctPane.index}\n`;
      report += `  - Title: ${status.ctPane.title || 'Default'}\n`;
      report += `  - Dimensions: ${status.ctPane.dimensions}\n`;
      report += `  - Path: ${status.ctPane.path}\n\n`;
    } else {
      report += `**Claude Terminal (CT Pane):** ⚠️ Not configured\n\n`;
    }
    
    // Available panes
    if (status.availablePanes.length > 0) {
      report += `**Available Panes:**\n`;
      status.availablePanes.forEach(pane => {
        const marker = pane.index === status.ctPane?.index ? ' 🤖 (CT Pane)' : '';
        const active = pane.active ? ' [ACTIVE]' : '';
        report += `  - Pane ${pane.index}: ${pane.title || 'Unnamed'} (${pane.dimensions})${marker}${active}\n`;
      });
      report += '\n';
    }
    
    // Recommendations
    if (!status.ctPane && status.availablePanes.length > 1) {
      report += `**💡 Recommendations:**\n`;
      report += `- Use pane ${status.availablePanes[1].index} as Claude Terminal: setup_claude_terminal with pane=${status.availablePanes[1].index}\n`;
      report += `- Or create a new pane: setup_claude_terminal with create=true\n`;
    }
    
    return {
      content: [
        {
          type: "text",
          text: report,
        },
      ],
    };
  }

  /**
   * Setup or reconfigure Claude Terminal
   */
  async setupClaudeTerminal(paneIndex = null, create = false) {
    if (create) {
      const newPane = await this.createClaudeTerminal();
      return {
        content: [
          {
            type: "text",
            text: `✅ Created new Claude Terminal pane ${newPane.index}\n\n🤖 Ready for command execution in your dedicated terminal space!`,
          },
        ],
      };
    }
    
    if (paneIndex !== null) {
      const targetPane = this.availablePanes.find(p => p.index === paneIndex);
      if (!targetPane) {
        throw new Error(`Pane ${paneIndex} not found. Available panes: ${this.availablePanes.map(p => p.index).join(', ')}`);
      }
      
      this.ctPane = targetPane;
      
      // Set pane title
      try {
        await execAsync(`tmux select-pane -t "${this.currentSession}:${paneIndex}" -T "Claude Terminal"`);
      } catch (error) {
        // Non-critical error
      }
      
      return {
        content: [
          {
            type: "text",
            text: `✅ Configured pane ${paneIndex} as Claude Terminal\n\n📍 CT Pane location: ${targetPane.path}\n🤖 Ready to execute commands in your dedicated terminal space!`,
          },
        ],
      };
    }
    
    // Auto-detect and setup
    await this.detectClaudeTerminal();
    if (this.ctPane) {
      return {
        content: [
          {
            type: "text",
            text: `✅ Auto-detected Claude Terminal: pane ${this.ctPane.index}\n\n🤖 Ready for command execution!`,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: `⚠️ Could not auto-detect suitable pane. Available panes: ${this.availablePanes.map(p => `${p.index} (${p.title || 'unnamed'})`).join(', ')}\n\nPlease specify a pane index or use create=true to make a new one.`,
          },
        ],
      };
    }
  }

  /**
   * List all tmux sessions
   */
  async listTmuxSessions() {
    try {
      const { stdout } = await execAsync('tmux list-sessions -F "#{session_name}:#{session_windows}:#{session_created}:#{session_attached}"');
      const sessions = stdout.trim().split('\n').map(line => {
        const [name, windows, created, attached] = line.split(':');
        return {
          name,
          windows: parseInt(windows),
          created: new Date(parseInt(created) * 1000).toLocaleString(),
          attached: attached === '1'
        };
      });

      let report = "🔍 **Available Tmux Sessions:**\n\n";
      sessions.forEach(session => {
        const current = session.name === this.currentSession ? ' 🎯 (CURRENT)' : '';
        const attached = session.attached ? ' 📎 (ATTACHED)' : '';
        report += `**${session.name}**${current}${attached}\n`;
        report += `  - Windows: ${session.windows}\n`;
        report += `  - Created: ${session.created}\n\n`;
      });

      return {
        content: [
          {
            type: "text",
            text: report,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to list tmux sessions: ${error.message}`);
    }
  }

  /**
   * Switch to different tmux session
   */
  async switchSession(sessionName) {
    try {
      // Verify session exists
      await execAsync(`tmux has-session -t "${sessionName}"`);
      
      this.currentSession = sessionName;
      await this.analyzeTmuxLayout();
      await this.detectClaudeTerminal();
      
      const status = await this.getTmuxStatus();
      
      let report = `✅ Switched to session: **${sessionName}**\n\n`;
      
      if (status.ctPane) {
        report += `🤖 Claude Terminal ready: pane ${status.ctPane.index}\n`;
      } else {
        report += `⚠️ No Claude Terminal detected in this session.\n`;
        if (status.availablePanes.length > 1) {
          report += `Available panes: ${status.availablePanes.map(p => p.index).join(', ')}\n`;
        }
      }
      
      return {
        content: [
          {
            type: "text",
            text: report,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to switch to session '${sessionName}': ${error.message}`);
    }
  }

  /**
   * WebSocket connection management
   */
  async connectWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(this.bridgeUrl);
      
      this.ws.on('open', () => {
        this.logInfo('🔗 Connected to tmux bridge');
        this.reconnectAttempts = 0;
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(message);
        } catch (error) {
          this.logError('Failed to parse WebSocket message:', error);
        }
      });

      this.ws.on('close', () => {
        this.logInfo('🔌 Bridge connection closed');
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.pow(2, this.reconnectAttempts) * 1000;
          setTimeout(() => {
            this.reconnectAttempts++;
            this.connectWebSocket();
          }, delay);
        }
      });

      this.ws.on('error', (error) => {
        this.logError('Bridge connection error:', error);
      });

    } catch (error) {
      this.logError('Failed to connect to bridge:', error);
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => {
          this.reconnectAttempts++;
          this.connectWebSocket();
        }, 5000);
      }
    }
  }

  /**
   * Handle WebSocket messages
   */
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
                text: message.output,
              },
            ],
          });
          this.pendingCommands.delete(message.id);
        } else if (message.status === 'timeout') {
          promise.resolve({
            content: [
              {
                type: "text", 
                text: `⏱️ Command timed out. Partial output:\n\n${message.output}`,
              },
            ],
          });
          this.pendingCommands.delete(message.id);
        }
        break;

      case 'error':
        promise.reject(new Error(message.error));
        this.pendingCommands.delete(message.id);
        break;

      case 'status':
        if (message.status === 'connected') {
          this.logInfo('Bridge connection established');
        }
        break;
    }
  }

  /**
   * Logging utilities
   */
  logInfo(message) {
    console.error(`[INFO] ${message}`);
  }

  logError(message, error = null) {
    console.error(`[ERROR] ${message}`, error || '');
  }

  /**
   * Start the MCP server
   */
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logInfo("🤖 Smart Tmux MCP Server running");
    
    // Initial status report
    const status = await this.getTmuxStatus();
    if (status.currentSession) {
      this.logInfo(`📍 Session: ${status.currentSession}`);
      if (status.ctPane) {
        this.logInfo(`🤖 Claude Terminal: pane ${status.ctPane.index}`);
      } else {
        this.logInfo(`⚠️ No Claude Terminal configured`);
      }
    }
  }
}

// Create and start server
const server = new SmartTmuxMCPServer();
server.start().catch(console.error);