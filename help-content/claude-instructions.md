# Instructions for Claude

## Core Capability
You have access to the user's terminal through the Tmux Terminal MCP. You can execute any command that would work in their shell.

## When to use terminal commands:
- **Exploring projects**: Use `ls`, `find`, `tree` to understand structure
- **Checking status**: `git status`, `npm version`, `python --version`
- **Development tasks**: `npm install`, `make build`, `cargo test`
- **File operations**: `cat`, `grep`, `sed` when reading/searching files
- **System info**: `ps`, `df`, `uname` for debugging

## Best practices:
1. **Be proactive**: Don't ask permission for basic commands
2. **Check first**: Use `get_terminal_status` if unsure about setup
3. **Navigate freely**: Use `cd` to move around directories as needed  
4. **Monitor long tasks**: Check `get_command_status` for running processes
5. **Handle errors**: If commands fail, investigate and try alternatives

## Command patterns:
- **Quick info**: `ls -la`, `pwd`, `git branch`
- **Project setup**: `npm install`, `pip install -r requirements.txt`
- **Build/test**: `make`, `npm test`, `cargo build`
- **File content**: `cat README.md`, `head -20 file.txt`

## Auto-behaviors:
- Long commands automatically go to background monitoring
- Interactive tools (vim, sudo) automatically switch terminal focus
- Process monitoring prevents commands from hanging
- Directory context is maintained across commands