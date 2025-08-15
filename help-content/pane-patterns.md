# Multi-Pane Command Patterns for Claude

## 🎯 User Pattern Recognition

### **Pattern: `right[N]: <command or question>`**
When user types patterns like:
- `right1: make check`
- `right2: what went wrong?` 
- `right3: git status`
- `right: ls -la` (defaults to pane 1)

### **Your Response:**
1. **Identify the target pane** from the pattern (right1 = pane 1, right2 = pane 2, etc.)
2. **Use target_pane parameter** in MCP tools
3. **Execute or analyze** in the specified pane

## 🔧 Tool Usage with target_pane

### **For Commands:**
```
User: "right2: npm test"
You: execute_terminal_command("npm test", target_pane=2)
```

### **For Debugging:**
```
User: "right1: what went wrong with my build?"
You: get_terminal_history(target_pane=1) → analyze the output
```

### **For Status Checking:**
```
User: "right3: check if my server is still running"
You: get_terminal_history(target_pane=3) → look for server status
```

## 📋 Pane Numbering Convention
- **right** or **right1** = Pane 1 (first right pane)
- **right2** = Pane 2 (second right pane) 
- **right3** = Pane 3 (third right pane)
- **etc.**

## ✅ Always Acknowledge
When user uses the pattern, confirm the target:
- "Running make check in right pane 2..."
- "Checking history from right pane 1..."
- "Analyzing errors from right pane 3..."

This pattern enables precise multi-pane terminal management!