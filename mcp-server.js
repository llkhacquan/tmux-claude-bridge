#!/usr/bin/env node

/**
 * Pure Node.js Tmux MCP Server
 * Implements Claude Terminal (CT Pane) with "Fire and Wait Briefly" execution strategy
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TmuxManager } from './tmux-manager.js';
import { CommandDetector } from './command-detector.js';
import { v4 as uuidv4 } from 'uuid';

class TmuxTerminalMCP {
  constructor() {
    this.server = new Server({
      name: 'tmux-terminal-mcp',
      version: '1.0.0',
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.tmux = new TmuxManager();
    this.detector = new CommandDetector();
    this.isInitialized = false;
    this.activeCommands = new Map();

    this.setupToolHandlers();
    this.setupRequestHandlers();
  }

  setupRequestHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'execute_terminal_command',
          description: 'Execute a command in the Claude Terminal (CT Pane) with intelligent timeout handling',
          inputSchema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The command to execute'
              },
              wait_for_completion: {
                type: 'boolean',
                description: 'Whether to wait for command completion (default: auto-detected)',
                default: null
              }
            },
            required: ['command']
          }
        },
        {
          name: 'get_terminal_status',
          description: 'Get the status of the Claude Terminal and tmux environment',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false
          }
        },
        {
          name: 'create_claude_terminal',
          description: 'Create a new Claude Terminal (CT Pane) if one doesn\'t exist',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false
          }
        },
        {
          name: 'switch_terminal_focus',
          description: 'Switch tmux focus to the Claude Terminal pane',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false
          }
        },
        {
          name: 'get_command_status',
          description: 'Check the status of running commands',
          inputSchema: {
            type: 'object',
            properties: {
              command_id: {
                type: 'string',
                description: 'Specific command ID to check (optional)',
              }
            },
            additionalProperties: false
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'execute_terminal_command':
            return await this.executeTerminalCommand(args);
          case 'get_terminal_status':
            return await this.getTerminalStatus();
          case 'create_claude_terminal':
            return await this.createClaudeTerminal();
          case 'switch_terminal_focus':
            return await this.switchTerminalFocus();
          case 'get_command_status':
            return await this.getCommandStatus(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  setupToolHandlers() {
    // Initialize on first tool call
    this.ensureInitialized = async () => {
      if (this.isInitialized) return;

      console.error('🔍 Initializing Tmux Terminal MCP...');
      
      // Detect tmux environment
      const env = await this.tmux.detectTmuxEnvironment();
      if (!env.inTmux) {
        throw new Error('❌ Not running in tmux session. Please start this MCP server from within tmux.');
      }

      console.error(`📍 Detected tmux session: ${env.session} (window ${env.window}, pane ${env.pane})`);

      // Discover or create Claude Terminal
      const discovery = await this.tmux.discoverClaudeTerminal();
      
      if (discovery.found) {
        console.error(discovery.message);
        if (discovery.assumed) {
          console.error('💡 Tip: You can create a dedicated CT Pane with create_claude_terminal tool');
        }
      } else {
        console.error(discovery.message);
        console.error('💡 Use create_claude_terminal tool to create one, or I can suggest when to create it.');
      }

      this.isInitialized = true;
    };
  }

  /**
   * Execute command with "Fire and Wait Briefly" strategy
   */
  async executeTerminalCommand({ command, wait_for_completion = null }) {
    await this.ensureInitialized();

    if (!this.tmux.ctPane) {
      return {
        content: [
          {
            type: 'text',
            text: '📋 No Claude Terminal pane available. Use create_claude_terminal to create one first.'
          }
        ]
      };
    }

    const commandId = uuidv4();
    const analysis = this.detector.analyzeCommand(command);
    const timeoutStrategy = this.detector.getTimeoutStrategy(command);
    
    console.error(`🚀 Executing: ${command}`);
    console.error(`📊 Analysis: ${analysis.category}, estimated ${analysis.estimatedDuration}s`);

    // Handle special cases first
    if (analysis.special?.needsPasswordPrompt) {
      await this.tmux.sendKeys(command, true);
      await this.tmux.focusClaudeTerminal();
      
      return {
        content: [
          {
            type: 'text',
            text: `🔐 Sudo password required in Claude Terminal (pane ${this.tmux.ctPane}). Focus switched to CT Pane for password entry.`
          }
        ]
      };
    }

    if (analysis.special?.editor || analysis.special?.repl || analysis.special?.monitor) {
      await this.tmux.sendKeys(command, true);
      await this.tmux.focusClaudeTerminal();
      
      return {
        content: [
          {
            type: 'text',
            text: `🎯 ${analysis.special.message}\n\nFocus switched to Claude Terminal (pane ${this.tmux.ctPane}).`
          }
        ]
      };
    }

    // Clear pane and execute command
    await this.tmux.clearPane();
    await this.tmux.sendKeys(command, true);

    // Implement "Fire and Wait Briefly" strategy
    const shouldWaitForCompletion = wait_for_completion !== null ? 
      wait_for_completion : 
      timeoutStrategy.strategy !== 'async';

    if (!shouldWaitForCompletion || timeoutStrategy.strategy === 'async') {
      // Start async monitoring
      this.monitorAsyncCommand(commandId, command, analysis);
      
      return {
        content: [
          {
            type: 'text',
            text: `🔄 ${command} started in Claude Terminal (pane ${this.tmux.ctPane})\n\n${timeoutStrategy.reason}\n\nCommand ID: ${commandId}\nUse get_command_status to check progress.`
          }
        ]
      };
    }

    // Wait briefly for completion
    const result = await this.waitForCommandCompletion(commandId, command, timeoutStrategy.timeout);
    
    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };
  }

  /**
   * Wait for command completion with timeout
   */
  async waitForCommandCompletion(commandId, command, timeoutMs) {
    const startTime = Date.now();
    const maxWaitTime = timeoutMs || 5000;
    let lastOutput = '';

    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        const output = await this.tmux.capturePane();
        
        if (this.tmux.isCommandComplete(output)) {
          const duration = ((Date.now() - startTime) / 1000).toFixed(1);
          return `✅ ${command} completed in ${duration}s:\n\n${output}`;
        }

        // Check for interactive prompts
        if (this.tmux.detectInteractivePrompts(output) && output !== lastOutput) {
          await this.tmux.focusClaudeTerminal();
          return `🔐 Interactive prompt detected in Claude Terminal (pane ${this.tmux.ctPane}). Focus switched for user input.\n\nCurrent output:\n${output}`;
        }

        lastOutput = output;
      } catch (error) {
        return `❌ Error monitoring command: ${error.message}`;
      }
    }

    // Timeout reached, switch to async monitoring
    this.monitorAsyncCommand(commandId, command, this.detector.analyzeCommand(command));
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    return `🔄 ${command} running longer than expected (${duration}s+). Switched to background monitoring.\n\nCommand ID: ${commandId}\nUse get_command_status to check progress.`;
  }

  /**
   * Monitor long-running command asynchronously
   */
  async monitorAsyncCommand(commandId, command, analysis) {
    this.activeCommands.set(commandId, {
      command,
      startTime: Date.now(),
      analysis,
      status: 'running'
    });

    // Poll every 10 seconds for completion
    const monitor = async () => {
      try {
        const output = await this.tmux.capturePane();
        
        if (this.tmux.isCommandComplete(output)) {
          const commandInfo = this.activeCommands.get(commandId);
          if (commandInfo) {
            const duration = ((Date.now() - commandInfo.startTime) / 1000).toFixed(1);
            commandInfo.status = 'completed';
            commandInfo.output = output;
            commandInfo.duration = duration;
            
            console.error(`✅ Background command completed: ${command} (${duration}s)`);
          }
          return;
        }

        // Check for interactive prompts
        if (this.tmux.detectInteractivePrompts(output)) {
          const commandInfo = this.activeCommands.get(commandId);
          if (commandInfo) {
            commandInfo.status = 'needs_interaction';
            commandInfo.output = output;
            
            console.error(`🔐 Background command needs interaction: ${command}`);
            await this.tmux.focusClaudeTerminal();
          }
          return;
        }

        // Continue monitoring
        setTimeout(monitor, 10000);
        
      } catch (error) {
        const commandInfo = this.activeCommands.get(commandId);
        if (commandInfo) {
          commandInfo.status = 'error';
          commandInfo.error = error.message;
        }
        console.error(`❌ Error monitoring background command: ${error.message}`);
      }
    };

    setTimeout(monitor, 10000); // Start monitoring in 10 seconds
  }

  /**
   * Get terminal status
   */
  async getTerminalStatus() {
    await this.ensureInitialized();

    const status = await this.tmux.getStatus();
    
    if (!status.connected) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ ${status.error}\n\n${status.suggestion || 'Please ensure you are running this MCP server from within a tmux session.'}`
          }
        ]
      };
    }

    const paneInfo = status.ctPaneInfo ? 
      `\n📏 CT Pane: ${status.ctPaneInfo.width}x${status.ctPaneInfo.height} at ${status.ctPaneInfo.path}` : 
      '\n❌ No Claude Terminal pane configured';

    return {
      content: [
        {
          type: 'text',
          text: `✅ Connected to tmux session: ${status.session}\n` +
                `🪟 Window: ${status.window} (${status.totalPanes} panes)\n` +
                `📍 Current pane: ${status.currentPane}\n` +
                `🎯 Claude Terminal pane: ${status.ctPane || 'none'}` +
                paneInfo
        }
      ]
    };
  }

  /**
   * Create Claude Terminal pane
   */
  async createClaudeTerminal() {
    await this.ensureInitialized();

    try {
      const result = await this.tmux.createClaudeTerminal();
      
      return {
        content: [
          {
            type: 'text',
            text: result.message + '\n\n🎯 Ready to execute commands in the Claude Terminal!'
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to create Claude Terminal: ${error.message}`
          }
        ]
      };
    }
  }

  /**
   * Switch focus to Claude Terminal
   */
  async switchTerminalFocus() {
    await this.ensureInitialized();

    if (!this.tmux.ctPane) {
      return {
        content: [
          {
            type: 'text',
            text: '📋 No Claude Terminal pane available. Use create_claude_terminal to create one first.'
          }
        ]
      };
    }

    try {
      const result = await this.tmux.focusClaudeTerminal();
      
      return {
        content: [
          {
            type: 'text',
            text: result.message
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to switch focus: ${error.message}`
          }
        ]
      };
    }
  }

  /**
   * Get command status
   */
  async getCommandStatus({ command_id } = {}) {
    if (command_id) {
      const commandInfo = this.activeCommands.get(command_id);
      
      if (!commandInfo) {
        return {
          content: [
            {
              type: 'text',
              text: `❓ Command ID ${command_id} not found in active commands.`
            }
          ]
        };
      }

      const duration = ((Date.now() - commandInfo.startTime) / 1000).toFixed(1);
      let statusText = `📊 Command Status: ${commandInfo.command}\n` +
                      `⏱️ Duration: ${commandInfo.duration || duration + 's (ongoing)'}\n` +
                      `📈 Status: ${commandInfo.status}\n`;

      if (commandInfo.output) {
        statusText += `\n📋 Output:\n${commandInfo.output}`;
      }

      if (commandInfo.error) {
        statusText += `\n❌ Error: ${commandInfo.error}`;
      }

      return {
        content: [
          {
            type: 'text',
            text: statusText
          }
        ]
      };
    }

    // List all active commands
    if (this.activeCommands.size === 0) {
      return {
        content: [
          {
            type: 'text',
            text: '📝 No active background commands.'
          }
        ]
      };
    }

    let statusText = `📝 Active Commands (${this.activeCommands.size}):\n\n`;
    
    for (const [id, info] of this.activeCommands.entries()) {
      const duration = info.duration || ((Date.now() - info.startTime) / 1000).toFixed(1) + 's';
      statusText += `🔹 ${info.command}\n`;
      statusText += `   ID: ${id}\n`;
      statusText += `   Status: ${info.status} (${duration})\n\n`;
    }

    return {
      content: [
        {
          type: 'text',
          text: statusText
        }
      ]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('🚀 Tmux Terminal MCP Server running');
    console.error('🎯 Ready to manage Claude Terminal (CT Pane)');
  }
}

// Run the server
const server = new TmuxTerminalMCP();
server.run().catch(console.error);