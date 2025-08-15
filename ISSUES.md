# Known Issues

## Issue #1: Timeout Strategy Not Being Enforced Properly

**Status**: Open  
**Severity**: Medium  
**Date**: August 15, 2025

### Description
The command timeout strategy defined in `command-detector.js` is not being properly enforced in the `executeTerminalCommand` method. Commands that should timeout and switch to background monitoring are instead waiting for full completion.

### Expected Behavior
1. `make check` command should be classified with 180-second estimated duration
2. Should get "extended" timeout strategy (30-second timeout)
3. Should timeout after 30 seconds and switch to background monitoring
4. Should provide command ID for status checking

### Actual Behavior
- `make check` ran for 20.9 seconds and completed synchronously
- No timeout occurred despite exceeding the expected 30-second limit for "extended" strategy
- Command returned full results instead of switching to async monitoring

### Root Cause Analysis
The `command-detector.js` logic appears correct:
```javascript
// make commands get 180s estimated duration
if (/^(make|pytest|npm\s+(run\s+)?test|git\s+clone)/i.test(command)) {
  return 180; // 3 minutes
}

// 180 > 30, so should get "extended" strategy  
if (analysis.estimatedDuration > 30) {
  return {
    strategy: 'extended',
    timeout: 30000, // 30 seconds
    reason: 'Medium duration command'
  };
}
```

But the `executeTerminalCommand` method may not be properly applying the timeout strategy.

### Steps to Reproduce
1. Navigate to a project with make commands (e.g., `cd ~/xtrading/nova`)
2. Run `execute_terminal_command "make check"`
3. Observe that command waits for full completion instead of timing out

### Test Commands
```bash
# Should timeout after 30s and go to background
make check

# Should timeout after 5s and go to background  
sleep 8 && echo done

# Quick command - should complete normally
ls -la
```

### Potential Fixes
1. **Debug timeout application**: Check if `timeoutStrategy.timeout` is being used correctly in `waitForCommandCompletion`
2. **Verify process monitoring**: Ensure process-based completion detection isn't overriding timeout logic
3. **Add timeout logging**: Add debug output to show when timeouts should trigger

### Files Involved
- `mcp-server.js` - `executeTerminalCommand` method
- `mcp-server.js` - `waitForCommandCompletion` method  
- `command-detector.js` - timeout strategy logic

### Priority
Medium - functionality works but doesn't follow the intended "Fire and Wait Briefly" strategy for medium-duration commands.

### Workaround
Users can manually specify `wait_for_completion: false` to force background monitoring, but this defeats the purpose of automatic command classification.