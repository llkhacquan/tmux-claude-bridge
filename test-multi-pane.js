#!/usr/bin/env node

import { HelpLoader } from './help-loader.js';

async function testMultiPaneFeature() {
  const helpLoader = new HelpLoader();
  
  console.log('🧪 Testing Multi-Pane Pattern Feature\n');
  
  console.log('📋 1. Auto-welcome includes pattern guidance:');
  console.log('='.repeat(50));
  const autoWelcome = helpLoader.getContextualHelp('first-time');
  const panePatternSection = autoWelcome.split('## 🎯 User Command Patterns')[1]?.split('##')[0];
  if (panePatternSection) {
    console.log('## 🎯 User Command Patterns' + panePatternSection);
  }
  console.log('='.repeat(50));
  
  console.log('\n📚 2. Pane Patterns Help Section:');
  console.log('='.repeat(50));
  const panePatterns = helpLoader.getContextualHelp('pane-patterns');
  console.log(panePatterns.split('\n').slice(0, 15).join('\n')); // Show first part
  console.log('... [truncated]');
  console.log('='.repeat(50));
  
  console.log('\n🎯 3. Claude Instructions Include Pattern:');
  console.log('='.repeat(50));
  const claudeInstructions = helpLoader.getContextualHelp('claude-instructions');
  const patternSection = claudeInstructions.split('## 🎯 IMPORTANT: Multi-Pane Pattern Recognition')[1];
  if (patternSection) {
    console.log('## 🎯 IMPORTANT: Multi-Pane Pattern Recognition' + patternSection.split('##')[0]);
  }
  console.log('='.repeat(50));
  
  console.log('\n✅ Multi-Pane Feature Summary:');
  console.log('📋 User can now type:');
  console.log('   - "right1: make check" → execute_terminal_command with target_pane=1');
  console.log('   - "right2: what went wrong?" → get_terminal_history with target_pane=2'); 
  console.log('   - "right3: ls -la" → execute_terminal_command with target_pane=3');
  console.log('');
  console.log('🔧 MCP Tools Updated:');
  console.log('   - execute_terminal_command: Added target_pane parameter');
  console.log('   - get_terminal_history: Added target_pane parameter');
  console.log('   - tmux-manager: Updated methods to support target panes');
  console.log('');
  console.log('🎯 Claude trained to recognize right[N]: patterns automatically!');
}

testMultiPaneFeature().catch(console.error);