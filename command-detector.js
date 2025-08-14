/**
 * Command Detector - Identifies long-running commands and command characteristics
 */

export class CommandDetector {
  constructor() {
    // Define patterns for long-running commands
    this.longRunningPatterns = [
      // Package managers
      /^npm\s+(install|ci|run\s+build|run\s+test)/i,
      /^yarn\s+(install|build|test)/i,
      /^pnpm\s+(install|run)/i,
      /^pip\s+install/i,
      /^conda\s+(install|create|update)/i,
      /^brew\s+(install|update|upgrade)/i,
      /^apt(-get)?\s+(install|update|upgrade)/i,
      /^yum\s+(install|update)/i,
      /^dnf\s+(install|update)/i,
      
      // Build tools
      /^make(\s+\w+)?$/i,
      /^cmake\s+/i,
      /^cargo\s+(build|test|install)/i,
      /^go\s+(build|test|install|get)/i,
      /^rustc\s+/i,
      /^gcc\s+/i,
      /^g\+\+\s+/i,
      
      // Docker
      /^docker\s+(build|pull|push|run.*-d)/i,
      /^docker-compose\s+(build|up|pull)/i,
      
      // Testing frameworks
      /^pytest/i,
      /^npm\s+test/i,
      /^yarn\s+test/i,
      /^jest/i,
      /^mocha/i,
      /^phpunit/i,
      /^mvn\s+test/i,
      /^gradle\s+test/i,
      
      // Database operations
      /^mongodump/i,
      /^mysqldump/i,
      /^pg_dump/i,
      
      // File operations
      /^rsync\s+/i,
      /^scp\s+.*:/i,
      /^tar\s+(czf|cjf)/i,
      /^zip\s+-r/i,
      /^unzip\s+/i,
      
      // Network operations
      /^wget\s+/i,
      /^curl.*-O/i,
      /^git\s+clone/i,
      /^git\s+pull/i,
      /^git\s+push/i,
      
      // System operations
      /^find\s+\/.*-exec/i,
      /^grep\s+-r/i,
      /^rg\s+-r/i,
    ];
    
    // Interactive command patterns
    this.interactivePatterns = [
      /^sudo\s+/i,
      /^ssh\s+/i,
      /^vim?\s+/i,
      /^nano\s+/i,
      /^emacs\s+/i,
      /^less\s+/i,
      /^more\s+/i,
      /^top$/i,
      /^htop$/i,
      /^man\s+/i,
      /^mysql\s*$/i,
      /^psql/i,
      /^mongo$/i,
      /^python$/i,
      /^node$/i,
      /^irb$/i,
      /^rails\s+console/i,
    ];
    
    // Commands that need special handling
    this.specialCommands = {
      editor: /^(vim?|nano|emacs)\s+/i,
      shell: /^(bash|zsh|fish|sh)$/i,
      repl: /^(python|node|irb)$/i,
      pager: /^(less|more)\s+/i,
      monitor: /^(top|htop|watch)\s*/i,
    };
  }

  /**
   * Analyze a command to determine its characteristics
   */
  analyzeCommand(command) {
    const trimmedCommand = command.trim();
    
    return {
      command: trimmedCommand,
      isLongRunning: this.isLongRunning(trimmedCommand),
      isInteractive: this.isInteractive(trimmedCommand),
      category: this.categorizeCommand(trimmedCommand),
      estimatedDuration: this.estimateDuration(trimmedCommand),
      requiresSudo: this.requiresSudo(trimmedCommand),
      special: this.getSpecialHandling(trimmedCommand)
    };
  }

  /**
   * Check if command is likely to be long-running
   */
  isLongRunning(command) {
    return this.longRunningPatterns.some(pattern => pattern.test(command));
  }

  /**
   * Check if command is interactive
   */
  isInteractive(command) {
    return this.interactivePatterns.some(pattern => pattern.test(command));
  }

  /**
   * Categorize the command type
   */
  categorizeCommand(command) {
    // Package management
    if (/^(npm|yarn|pnpm|pip|conda|brew|apt|yum|dnf)/i.test(command)) {
      return 'package-manager';
    }
    
    // Build tools
    if (/^(make|cmake|cargo|go\s+build|rustc|gcc|g\+\+)/i.test(command)) {
      return 'build';
    }
    
    // Docker
    if (/^docker/i.test(command)) {
      return 'container';
    }
    
    // Testing
    if (/^(pytest|.*test|jest|mocha)/i.test(command)) {
      return 'testing';
    }
    
    // Git operations
    if (/^git\s+/i.test(command)) {
      return 'version-control';
    }
    
    // File operations
    if (/^(ls|find|grep|cp|mv|rm|tar|zip)/i.test(command)) {
      return 'file-system';
    }
    
    // Network
    if (/^(curl|wget|ssh|scp|ping)/i.test(command)) {
      return 'network';
    }
    
    // System monitoring
    if (/^(ps|top|htop|df|du|free|uptime)/i.test(command)) {
      return 'system';
    }
    
    return 'general';
  }

  /**
   * Estimate command duration in seconds
   */
  estimateDuration(command) {
    // Very long operations (10+ minutes)
    if (/^(npm\s+install|yarn\s+install|docker\s+build|cargo\s+build.*--release)/i.test(command)) {
      return 600; // 10 minutes
    }
    
    // Long operations (2-5 minutes)
    if (/^(make|pytest|npm\s+(run\s+)?test|git\s+clone)/i.test(command)) {
      return 180; // 3 minutes
    }
    
    // Medium operations (30 seconds - 2 minutes)
    if (/^(pip\s+install|go\s+build|cargo\s+build)/i.test(command)) {
      return 90; // 1.5 minutes
    }
    
    // Short operations (5-30 seconds)
    if (/^(npm\s+run|yarn\s+run|git\s+(pull|push))/i.test(command)) {
      return 15; // 15 seconds
    }
    
    // Very short operations (< 5 seconds)
    return 3;
  }

  /**
   * Check if command requires sudo
   */
  requiresSudo(command) {
    return /^sudo\s+/.test(command);
  }

  /**
   * Get special handling requirements for command
   */
  getSpecialHandling(command) {
    const special = {};
    
    // Check for each special command type
    for (const [type, pattern] of Object.entries(this.specialCommands)) {
      if (pattern.test(command)) {
        special[type] = true;
      }
    }
    
    // Interactive prompts handling
    if (this.requiresSudo(command)) {
      special.needsPasswordPrompt = true;
    }
    
    // Editor commands need focus switching
    if (special.editor) {
      special.needsFocus = true;
      special.message = "Editor opened in CT Pane. Switch to pane for editing.";
    }
    
    // REPL commands stay running
    if (special.repl) {
      special.staysRunning = true;
      special.message = "REPL started in CT Pane. Use 'exit()' or Ctrl+D to quit.";
    }
    
    // Monitor commands need to be stopped manually
    if (special.monitor) {
      special.needsManualStop = true;
      special.message = "Monitor started in CT Pane. Press 'q' or Ctrl+C to stop.";
    }
    
    return Object.keys(special).length > 0 ? special : null;
  }

  /**
   * Get user-friendly description of what the command does
   */
  getCommandDescription(command) {
    const analysis = this.analyzeCommand(command);
    
    const descriptions = {
      'package-manager': 'Installing or managing packages',
      'build': 'Building or compiling code',
      'container': 'Docker container operations',
      'testing': 'Running tests',
      'version-control': 'Git version control operations',
      'file-system': 'File system operations',
      'network': 'Network operations',
      'system': 'System monitoring or information',
      'general': 'General command execution'
    };
    
    return descriptions[analysis.category] || 'Command execution';
  }

  /**
   * Get timeout strategy for command
   */
  getTimeoutStrategy(command) {
    const analysis = this.analyzeCommand(command);
    
    if (analysis.isInteractive) {
      return {
        strategy: 'no-timeout',
        reason: 'Interactive command requires user input'
      };
    }
    
    if (analysis.estimatedDuration > 300) { // 5 minutes
      return {
        strategy: 'async',
        timeout: 5000, // Wait 5 seconds then go async
        reason: 'Long-running command, switching to background monitoring'
      };
    }
    
    if (analysis.estimatedDuration > 30) {
      return {
        strategy: 'extended',
        timeout: 30000, // 30 seconds
        reason: 'Medium duration command'
      };
    }
    
    return {
      strategy: 'quick',
      timeout: 5000, // 5 seconds
      reason: 'Quick command execution'
    };
  }
}