# Pager Mode Detection Implementation

**Date**: August 15, 2025  
**Feature**: Detect and handle pager mode (less, more, git log, etc.) in Claude Terminal  
**Version**: Starting from v1.1.0  

## Overview

This document tracks the implementation of pager mode detection and handling in the Tmux Terminal MCP. When commands like `git log`, `less`, `man`, etc. open pagers, the MCP needs to detect this state and inform Claude, allowing intelligent handling of the pager interface.

## Problem Statement

Commands that open pagers create several issues:
1. **Hanging commands** - MCP waits indefinitely for pager to exit
2. **No user feedback** - Claude doesn't know a pager is open
3. **Limited interaction** - No way for Claude to navigate or exit pagers
4. **Poor UX** - Users get stuck in pager mode without guidance

## Research Phase

### Tmux API Testing (Completed)

We tested tmux's built-in format variables for reliable pager detection:

**Test Setup**: Ran `less package.json` in pane 1

**Results**:
```bash
# With pager active:
tmux display-message -t 1 -p '#{pane_current_command}'  # → "less"
tmux display-message -t 1 -p '#{alternate_on}'          # → "1" 
tmux display-message -t 1 -p '#{pane_in_mode}'          # → "0"

# After exiting pager (pressed 'q'):
tmux display-message -t 1 -p '#{pane_current_command}'  # → "zsh"
tmux display-message -t 1 -p '#{alternate_on}'          # → "0"
```

**Key Findings**:
- `#{alternate_on}` is the most reliable indicator (pagers use alternate screen)
- `#{pane_current_command}` identifies the specific pager type
- State changes immediately when pager exits
- No need for complex output parsing

## Implementation Strategy

### Detection Methods (Priority Order)
1. **Primary**: `#{alternate_on}` - Detects alternate screen mode
2. **Secondary**: `#{pane_current_command}` - Identifies pager type  
3. **Validation**: Known pager command list for confirmation

### Response Strategy
When pager detected, MCP returns structured response letting Claude decide:
- Auto-exit and capture content
- Switch focus for manual navigation
- Page through content automatically
- Exit immediately

## Implementation Log

### Phase 1: Core Detection Methods
**Status**: Starting implementation
**Target**: Add pager detection to TmuxManager class

Methods to implement:
- `detectPagerState(paneIndex)` - Main detection logic
- `isPagerActive(paneIndex)` - Simple boolean check
- `getPagerInfo(paneIndex)` - Detailed pager information
- `sendPagerKeys(keys, paneIndex)` - Send keys to pager

### Phase 2: MCP Integration  
**Status**: Pending
**Target**: Integrate with executeTerminalCommand flow

### Phase 3: New MCP Tools
**Status**: Pending  
**Target**: Add pager-specific MCP tools

### Phase 4: Testing & Documentation
**Status**: Pending
**Target**: Comprehensive testing and user documentation

---

## Implementation Details

### TmuxManager Enhancements ✅ **COMPLETED**

Added comprehensive pager detection methods to `tmux-manager.js`:

**Core Detection Method**: `detectPagerState(paneIndex)`
- Uses tmux format variables: `#{pane_current_command}` and `#{alternate_on}`
- Returns detailed pager state with confidence level
- Handles errors gracefully

**Key Methods Added**:
```javascript
// Main detection - returns full pager state object
detectPagerState(paneIndex) → { isPager, command, alternateScreen, confidence }

// Simple boolean check
isPagerActive(paneIndex) → boolean

// Detailed pager info with suggested actions
getPagerInfo(paneIndex) → { active, command, suggestedActions, commonKeys }

// Send keys to pager
sendPagerKeys(keys, paneIndex) → { success, keys, pane }
```

**Smart Features**:
- **Confidence levels**: 'high' (alternate screen), 'medium' (known pager), 'low'
- **Pager-specific suggestions**: Different actions for less, git, man pages
- **Key mapping help**: Common navigation keys for each pager type
- **Error handling**: Graceful fallbacks when detection fails

**Known Pager Commands**:
`less, more, most, bat, man, git, journalctl, systemctl, docker, kubectl, vim, nano, emacs, vi`

### MCP Server Changes ✅ **COMPLETED**

Added three new MCP tools to `mcp-server.js` for pager interaction:

**Tool Definitions Added**:
1. **`detect_pager`** - Basic pager detection tool
   - Returns simple boolean detection status
   - Shows command name and confidence level

2. **`get_pager_info`** - Detailed pager information with suggestions
   - Provides comprehensive pager state
   - Includes suggested actions (auto_read_all, manual_control, exit_pager, etc.)
   - Lists common key mappings specific to pager type

3. **`send_pager_keys`** - Send keys to active pager
   - Allows programmatic control of pager
   - Supports all standard pager keys (q, space, j, k, /, etc.)

**Handler Methods Added**:
```javascript
// Lines 764-803: detectPager()
// Lines 808-858: getPagerInfo() 
// Lines 863-901: sendPagerKeys()
```

**Integration Points**:
- Added to tool list definitions (lines 145-194)
- Connected to executeToolRequest dispatcher (lines 253-258)
- Full error handling and validation included

### New MCP Tools ✅ **COMPLETED**

All three pager interaction tools have been implemented:

1. **detect_pager**: Simple detection with confidence levels
2. **get_pager_info**: Comprehensive pager state and suggestions  
3. **send_pager_keys**: Programmatic pager control

**Tool Features**:
- Automatic target pane detection (defaults to CT Pane)
- Graceful error handling and validation
- Pager-specific suggested actions and key mappings
- Support for all common pagers (less, git, man, etc.)

### Test Results ✅ **COMPLETED**

**Initial Testing Phase**:
- Successfully created pager using `less package.json` 
- Command properly detected as interactive by existing MCP
- Pager is running in alternate screen mode in pane 1

**Next Steps Required**:
- MCP restart needed to load new pager detection tools
- Full integration testing with `detect_pager`, `get_pager_info`, `send_pager_keys`
- Validation of tmux API integration (`#{alternate_on}`, `#{pane_current_command}`)

**Current Status**: ✅ **FEATURE COMPLETE AND TESTED**

**Final Test Results**:
- ✅ Successfully created pager with `git log --oneline`
- ✅ `detect_pager` correctly identified "git (confidence: high) [alternate screen]"
- ✅ `get_pager_info` provided comprehensive pager state and action suggestions
- ✅ `send_pager_keys` successfully sent 'q' key to exit pager
- ✅ All tmux API integration working perfectly (`#{alternate_on}`, `#{pane_current_command}`)
- ✅ Auto-detection of existing CT Panes resolved
- ✅ Version bumped to 1.2.0 for pager detection release

---

## Usage Examples ✅ **COMPLETED**

### Basic Pager Detection

```javascript
// Check if any pager is currently active
await mcp.detect_pager()
// Returns: "Pager detected: git (confidence: high) [alternate screen]"
// Or: "No pager detected"
```

### Getting Detailed Pager Information

```javascript
// Get comprehensive pager state and suggestions
await mcp.get_pager_info()
```

**Sample Output**:
```
Active Pager: git
Alternate Screen: Yes  
Confidence: high

Suggested Actions:
- auto_read_all - Capture git output automatically
- exit_pager - Press q to exit git pager
- manual_control - Navigate git diff/log manually

Common Keys:
  q: Exit pager
  Space: Next page
  b: Previous page
  j: Down one line
  k: Up one line
  g: Go to beginning
  G: Go to end
  /: Search forward
  ?: Search backward
  n: Next search result
  N: Previous search result
```

### Controlling Pagers Programmatically

```javascript
// Exit any pager
await mcp.send_pager_keys({keys: "q"})

// Navigate pager content
await mcp.send_pager_keys({keys: " "})  // Next page
await mcp.send_pager_keys({keys: "b"})  // Previous page
await mcp.send_pager_keys({keys: "G"})  // Go to end
await mcp.send_pager_keys({keys: "g"})  // Go to beginning

// Search in pager
await mcp.send_pager_keys({keys: "/error"})  // Search for "error"
```

### Claude Auto-Usage Pattern

To make Claude automatically use these tools without asking, add to your Claude Code settings or CLAUDE.md:

```markdown
# Pager Detection Settings
When commands open pagers (git log, less, man, etc.), automatically:
1. Use detect_pager to check pager state
2. Use get_pager_info for available actions  
3. Choose appropriate action based on context:
   - For git log: auto-read content then exit
   - For man pages: offer manual control or auto-exit
   - For stuck commands: auto-exit to unstick
```

### Common Use Cases

**1. Automatic Git Log Reading**
```bash
# Command opens pager
git log --oneline

# Claude can detect and auto-read:
detect_pager() → "git (confidence: high)"
send_pager_keys("G") → Go to end
send_pager_keys("g") → Go to beginning  
send_pager_keys("q") → Exit after reading
```

**2. Interactive Pager Control**
```bash
# Open manual page
man tmux

# Claude offers control options:
get_pager_info() → Shows available keys
# User can choose: exit_pager, manual_control, auto_read_all
```

**3. Handling Stuck Commands**
```bash
# Long output command gets stuck in pager
docker logs container-id

# Claude detects and offers solutions:
detect_pager() → "docker (confidence: medium)"
get_pager_info() → Suggests auto_read_all or exit_pager
send_pager_keys("q") → Unstick the command
```

## Known Limitations

*[To be documented during testing]*

## Future Enhancements

- Support for custom pager configurations
- Integration with specific git workflows
- Advanced pager navigation features