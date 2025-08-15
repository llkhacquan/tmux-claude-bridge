# Best Practices

1. **Let MCP Handle Strategy**: Don't manually specify wait_for_completion unless needed
2. **Monitor Long Tasks**: Use get_command_status for background commands
3. **Interactive Commands**: MCP automatically switches focus when needed
4. **Debugging**: Use dual approach - both MCP tools and direct tmux commands