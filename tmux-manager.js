/**
 * Tmux Manager - Handles all tmux command operations and CT Pane management
 */
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export class TmuxManager {
  constructor() {
    this.currentSession = null;
    this.currentWindow = null;
    this.currentPane = null;
    this.ctPane = null; // Claude Terminal Pane
    this.runningCommands = new Map();
  }

  /**
   * Detect if running inside a tmux session
   */
  async detectTmuxEnvironment() {
    try {
      const { stdout } = await execAsync('tmux display-message -p "#S:#I.#P"');
      const [session, windowPane] = stdout.trim().split(':');
      const [window, pane] = windowPane.split('.');
      
      this.currentSession = session;
      this.currentWindow = window;
      this.currentPane = pane;
      
      return {
        inTmux: true,
        session,
        window: parseInt(window),
        pane: parseInt(pane)
      };
    } catch (error) {
      return { inTmux: false, error: error.message };
    }
  }

  /**
   * List all panes in current window with detailed info
   */
  async listPanes() {
    try {
      const { stdout } = await execAsync(
        `tmux list-panes -F '#{pane_index}:#{pane_width}x#{pane_height}:#{pane_current_path}:#{pane_active}:#{pane_title}'`
      );
      
      return stdout.trim().split('\n').map(line => {
        const [index, size, path, active, title] = line.split(':');
        const [width, height] = size.split('x');
        return {
          index: parseInt(index),
          width: parseInt(width),
          height: parseInt(height),
          path,
          active: active === '1',
          title: title || ''
        };
      });
    } catch (error) {
      throw new Error(`Failed to list panes: ${error.message}`);
    }
  }

  /**
   * Discover Claude Terminal (CT Pane) using intelligent detection
   */
  async discoverClaudeTerminal() {
    const panes = await this.listPanes();
    
    // Strategy 1: Look for existing CT Pane by title
    let ctPane = panes.find(pane => 
      pane.title && (
        pane.title.toLowerCase().includes('claude') ||
        pane.title.toLowerCase().includes('terminal') ||
        pane.title.toLowerCase().includes('ct')
      )
    );
    
    if (ctPane) {
      this.ctPane = ctPane.index;
      return {
        found: true,
        pane: ctPane,
        message: `✓ Found Claude Terminal in pane ${ctPane.index}`
      };
    }
    
    // Strategy 2: Use rightmost pane if multiple panes exist
    if (panes.length > 1) {
      const rightmostPane = panes.reduce((prev, current) => 
        current.index > prev.index ? current : prev
      );
      
      this.ctPane = rightmostPane.index;
      return {
        found: true,
        pane: rightmostPane,
        message: `✓ Using rightmost pane ${rightmostPane.index} as Claude Terminal`,
        assumed: true
      };
    }
    
    // No suitable pane found
    return {
      found: false,
      message: "📋 No dedicated Claude Terminal found. Should I create one?"
    };
  }

  /**
   * Create a new Claude Terminal pane
   */
  async createClaudeTerminal() {
    try {
      // Split window horizontally (create right pane)
      const { stdout } = await execAsync(
        `tmux split-window -h -t ${this.currentSession}:${this.currentWindow} -P -F '#{pane_index}'`
      );
      
      const newPaneIndex = parseInt(stdout.trim());
      this.ctPane = newPaneIndex;
      
      // Set pane title
      await execAsync(`tmux select-pane -t ${this.currentSession}:${this.currentWindow}.${newPaneIndex} -T "Claude Terminal"`);
      
      // Sync directory to current working directory
      await this.syncDirectory();
      
      return {
        success: true,
        pane: newPaneIndex,
        message: `✅ Created Claude Terminal (CT Pane) in pane ${newPaneIndex}`
      };
    } catch (error) {
      throw new Error(`Failed to create Claude Terminal: ${error.message}`);
    }
  }

  /**
   * Sync CT Pane directory to current working directory
   */
  async syncDirectory() {
    if (!this.ctPane) {
      throw new Error('No Claude Terminal pane available');
    }
    
    const cwd = process.cwd();
    await this.sendKeys(`cd "${cwd}"`, true);
    
    // Wait a moment for cd to complete
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Send keys to target pane
   */
  async sendKeys(command, pressEnter = false, targetPane = null) {
    const paneIndex = targetPane || this.ctPane;
    if (!paneIndex) {
      throw new Error('No target pane specified and no default Claude Terminal pane available');
    }
    
    const target = `${this.currentSession}:${this.currentWindow}.${paneIndex}`;
    const enterKey = pressEnter ? ' C-m' : '';
    
    try {
      await execAsync(`tmux send-keys -t ${target} '${command.replace(/'/g, "'\"'\"'")}' ${enterKey}`);
    } catch (error) {
      throw new Error(`Failed to send keys to pane ${paneIndex}: ${error.message}`);
    }
  }

  /**
   * Capture pane content
   */
  async capturePane() {
    if (!this.ctPane) {
      throw new Error('No Claude Terminal pane available');
    }
    
    const target = `${this.currentSession}:${this.currentWindow}.${this.ctPane}`;
    
    try {
      const { stdout } = await execAsync(`tmux capture-pane -t ${target} -p`);
      return this.cleanOutput(stdout);
    } catch (error) {
      throw new Error(`Failed to capture pane: ${error.message}`);
    }
  }

  /**
   * Clean tmux output (remove ANSI escape sequences, etc.)
   */
  cleanOutput(output) {
    return output
      // Remove all ANSI escape sequences (more comprehensive)
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/\x1b\[[\?\!0-9;]*[a-zA-Z]/g, '')
      .replace(/\x1b[)(0-9A-Za-z]/g, '')
      .replace(/\x1b[\[\]()#;?]*[0-9A-Fa-f]*/g, '')
      // Remove other control sequences but keep newlines and tabs
      .replace(/[\x00-\x08\x0B-\x1f\x7f-\x9f]/g, '')
      // Remove carriage returns
      .replace(/\r/g, '')
      // Trim excessive whitespace but preserve structure
      .split('\n')
      .map(line => line.trimRight())
      .join('\n')
      .trim();
  }

  /**
   * Get the process ID of the shell running in the CT Pane
   */
  async getShellPid() {
    if (!this.ctPane) {
      throw new Error('No Claude Terminal pane available');
    }
    
    const target = `${this.currentSession}:${this.currentWindow}.${this.ctPane}`;
    
    try {
      const { stdout } = await execAsync(`tmux display-message -t ${target} -p '#{pane_pid}'`);
      return parseInt(stdout.trim());
    } catch (error) {
      throw new Error(`Failed to get shell PID: ${error.message}`);
    }
  }

  /**
   * Get child processes of a given PID
   */
  async getChildProcesses(parentPid) {
    try {
      const { stdout } = await execAsync(`pgrep -P ${parentPid} 2>/dev/null || true`);
      return stdout.trim() ? stdout.trim().split('\n').map(pid => parseInt(pid)) : [];
    } catch (error) {
      // pgrep returns non-zero when no processes found, which is normal
      return [];
    }
  }

  /**
   * Check if pane is idle (no child processes running)
   */
  async isPaneIdle() {
    if (!this.ctPane) {
      throw new Error('No Claude Terminal pane available');
    }
    
    try {
      const shellPid = await this.getShellPid();
      const childProcesses = await this.getChildProcesses(shellPid);
      
      // Pane is idle if shell has no child processes
      return childProcesses.length === 0;
    } catch (error) {
      // If we can't determine, fall back to false (assume busy)
      console.error('Error checking pane idle state:', error.message);
      return false;
    }
  }

  /**
   * Check if command is complete using process monitoring (preferred method)
   */
  async isCommandCompleteByProcess() {
    return await this.isPaneIdle();
  }

  /**
   * Legacy: Check if command is complete by looking for shell prompt patterns
   * Kept as fallback method for compatibility
   */
  isCommandCompleteByOutput(output) {
    const lines = output.split('\n');
    if (lines.length === 0) return false;
    
    const lastLine = lines[lines.length - 1].trim();
    
    // Common shell prompt patterns
    const promptPatterns = [
      /\$\s*$/,     // Bash/Zsh prompt ending with $
      /#\s*$/,      // Root prompt ending with #
      />\s*$/,      // Windows prompt ending with >
      /%\s*$/,      // Some shell prompts ending with %
      /❯\s*$/,      // Modern shell prompts (starship, etc.)
      /➜.*$/,       // Oh-my-zsh style prompts starting with ➜
      /.*git:\([^)]+\)\s*$/,  // Git branch prompts ending with git:(branch)
    ];
    
    return promptPatterns.some(pattern => pattern.test(lastLine));
  }

  /**
   * Primary command completion detection using process monitoring
   */
  async isCommandComplete() {
    try {
      // Try process-based detection first (more reliable)
      return await this.isCommandCompleteByProcess();
    } catch (error) {
      console.error('Process-based detection failed, using output fallback:', error.message);
      
      // Fall back to output-based detection if process monitoring fails
      try {
        const output = await this.capturePane();
        return this.isCommandCompleteByOutput(output);
      } catch (fallbackError) {
        console.error('Both detection methods failed:', fallbackError.message);
        return false;
      }
    }
  }

  /**
   * Switch focus to CT Pane
   */
  async focusClaudeTerminal() {
    if (!this.ctPane) {
      throw new Error('No Claude Terminal pane available');
    }
    
    const target = `${this.currentSession}:${this.currentWindow}.${this.ctPane}`;
    
    try {
      await execAsync(`tmux select-pane -t ${target}`);
      return { success: true, message: `Switched focus to Claude Terminal (pane ${this.ctPane})` };
    } catch (error) {
      throw new Error(`Failed to focus Claude Terminal: ${error.message}`);
    }
  }

  /**
   * Clear the target pane
   */
  async clearPane(targetPane = null) {
    const paneIndex = targetPane || this.ctPane;
    if (!paneIndex) {
      throw new Error('No target pane specified and no default Claude Terminal pane available');
    }
    
    // Send Ctrl+C to interrupt any running command, then clear
    await this.sendKeys('', false, paneIndex); // Just to ensure pane is active
    await execAsync(`tmux send-keys -t ${this.currentSession}:${this.currentWindow}.${paneIndex} C-c C-l`);
    
    // Wait for clear to take effect
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  /**
   * Get status of CT Pane and tmux environment
   */
  async getStatus() {
    const env = await this.detectTmuxEnvironment();
    
    if (!env.inTmux) {
      return {
        connected: false,
        error: 'Not running in tmux session',
        suggestion: 'Please run this MCP server from within a tmux session'
      };
    }
    
    try {
      const panes = await this.listPanes();
      const ctPaneInfo = this.ctPane ? panes.find(p => p.index === this.ctPane) : null;
      
      return {
        connected: true,
        session: this.currentSession,
        window: this.currentWindow,
        currentPane: this.currentPane,
        ctPane: this.ctPane,
        ctPaneInfo,
        totalPanes: panes.length,
        panes
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Detect if output contains interactive prompts
   */
  detectInteractivePrompts(output) {
    const interactivePatterns = [
      /password.*:/i,
      /\[y\/n\]/i,
      /\[yes\/no\]/i,
      /continue\?/i,
      /press.*key/i,
      /enter.*passphrase/i,
      /sudo.*password/i,
    ];
    
    return interactivePatterns.some(pattern => pattern.test(output));
  }

  /**
   * Get recent terminal history from target pane - just return the raw cleaned lines
   */
  async getTerminalHistory(lines = 50, targetPane = null) {
    const paneIndex = targetPane || this.ctPane;
    if (!paneIndex) {
      throw new Error('No target pane specified and no default Claude Terminal pane available');
    }
    
    const target = `${this.currentSession}:${this.currentWindow}.${paneIndex}`;
    
    try {
      // Capture terminal history
      const { stdout } = await execAsync(`tmux capture-pane -t ${target} -p -S -${lines}`);
      const cleanOutput = this.cleanOutput(stdout);
      
      // Just return the cleaned lines - let the LLM parse them
      return cleanOutput;
    } catch (error) {
      throw new Error(`Failed to get terminal history from pane ${paneIndex}: ${error.message}`);
    }
  }

}