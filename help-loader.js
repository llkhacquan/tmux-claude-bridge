/**
 * Help Content Loader - Loads help content from markdown files
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class HelpLoader {
  constructor(helpDir = 'help-content') {
    this.helpDir = join(__dirname, helpDir);
  }

  /**
   * Load a specific help file
   */
  loadFile(filename) {
    try {
      const filePath = join(this.helpDir, `${filename}.md`);
      return readFileSync(filePath, 'utf-8').trim();
    } catch (error) {
      console.error(`Failed to load help file ${filename}:`, error.message);
      return `# Help file not found\n\nSorry, the help file "${filename}" could not be loaded.`;
    }
  }

  /**
   * Load multiple help files and combine them
   */
  loadMultiple(filenames, separator = '\n\n') {
    return filenames
      .map(filename => this.loadFile(filename))
      .join(separator);
  }

  /**
   * Get the complete help guide (all sections)
   */
  getCompleteHelp() {
    const sections = [
      'welcome',
      'getting-started', 
      'tools',
      'features',
      'best-practices',
      'troubleshooting',
      'auto-welcome'
    ];

    return this.loadMultiple(sections);
  }

  /**
   * Get quick help (essential sections only)
   */
  getQuickHelp() {
    const sections = [
      'welcome',
      'getting-started',
      'tools'
    ];

    return this.loadMultiple(sections);
  }

  /**
   * Get contextual help based on situation
   */
  getContextualHelp(context = 'default') {
    switch (context) {
      case 'first-time':
        return this.loadFile('auto-welcome');
      
      case 'claude-instructions':
        return this.loadFile('claude-instructions');
      
      case 'troubleshooting':
        return this.loadMultiple(['troubleshooting', 'tools']);
      
      case 'tools':
        return this.loadFile('tools');
        
      case 'quick':
        return this.getQuickHelp();
        
      default:
        return this.getCompleteHelp();
    }
  }
}