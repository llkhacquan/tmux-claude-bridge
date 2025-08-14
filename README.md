# tmux-claude-bridge

A WebSocket-based bridge that allows Claude AI to execute commands in a tmux terminal pane and receive real-time output. This enables seamless integration between Claude's AI capabilities and your local development environment.

## Features

- **Real-time Command Execution**: Send commands from Claude to a specific tmux pane
- **Live Output Capture**: Stream command output back to Claude as it happens
- **Command Completion Detection**: Automatically detects when commands finish executing
- **Multiple Client Support**: Multiple WebSocket clients can connect simultaneously
- **Robust Error Handling**: Comprehensive error handling and timeout management
- **Configurable**: Environment variables and config file support
- **Health Monitoring**: Built-in health check endpoint
- **Clean Output**: ANSI escape sequence removal and output formatting

## Architecture

```
┌─────────────┐    WebSocket    ┌─────────────────┐    tmux commands    ┌─────────────┐
│   Claude    │ ────────────── │  Go WebSocket   │ ─────────────────── │    tmux     │
│     AI      │                │     Server      │                     │    pane     │
└─────────────┘                └─────────────────┘                     └─────────────┘
```

## Prerequisites

- Go 1.21 or later
- tmux installed and running
- A tmux session set up with split panes

## Quick Start

1. **Clone and build the application:**
   ```bash
   git clone <repository-url>
   cd tmux-claude-bridge
   go mod tidy
   go build -o tmux-claude-bridge
   ```

2. **Set up your tmux session:**
   ```bash
   # Create a new tmux session with horizontal split
   tmux new-session -d -s claude-bridge
   tmux split-window -h -t claude-bridge
   ```

3. **Start the bridge server:**
   ```bash
   ./tmux-claude-bridge
   ```

4. **Test the connection:**
   Open `http://localhost:8080` in your browser to access the test client, or check health at `http://localhost:8080/health`

## Configuration

### Environment Variables

- `PORT`: Server port (default: 8080)
- `TMUX_SESSION`: Target tmux session name (default: claude-bridge)
- `TMUX_PANE`: Target pane number (default: 1)
- `LOG_LEVEL`: Logging level (default: info)
- `CONFIG_FILE`: Path to JSON configuration file

### Configuration File

Create a `config.json` file:

```json
{
  "port": "8080",
  "tmux_session": "claude-bridge",
  "tmux_pane": "1",
  "log_level": "info"
}
```

## WebSocket API

### Message Format

All messages are JSON objects with the following structure:

```json
{
  "type": "message_type",
  "command": "optional_command",
  "output": "optional_output",
  "error": "optional_error",
  "status": "optional_status",
  "id": "optional_request_id"
}
```

### Client → Server Messages

**Execute Command:**
```json
{
  "type": "execute",
  "command": "ls -la",
  "id": "unique-request-id"
}
```

**Ping:**
```json
{
  "type": "ping",
  "id": "ping-id"
}
```

### Server → Client Messages

**Output (Running):**
```json
{
  "type": "output",
  "output": "command output...",
  "status": "running",
  "id": "request-id"
}
```

**Output (Complete):**
```json
{
  "type": "output",
  "output": "final command output...",
  "status": "complete",
  "id": "request-id"
}
```

**Error:**
```json
{
  "type": "error",
  "error": "error message",
  "id": "request-id"
}
```

**Pong:**
```json
{
  "type": "pong",
  "id": "ping-id"
}
```

## Usage Examples

### Basic Command Execution

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onopen = function() {
    // Execute a command
    ws.send(JSON.stringify({
        type: 'execute',
        command: 'echo "Hello from Claude!"',
        id: 'cmd-1'
    }));
};

ws.onmessage = function(event) {
    const msg = JSON.parse(event.data);
    console.log('Received:', msg);
};
```

### Long-running Commands

The bridge automatically handles long-running commands and streams output in real-time:

```javascript
ws.send(JSON.stringify({
    type: 'execute',
    command: 'npm install',
    id: 'install-cmd'
}));
```

## Integration with Claude Code

This bridge is designed to work as an MCP (Multi-Context Proxy) server for Claude Code. See `CLAUDE.md` for detailed integration instructions.

## Tmux Session Setup

The application expects a specific tmux session layout:

1. **Session Name**: Default is `claude-bridge` (configurable)
2. **Pane Layout**: Horizontal split with commands executed in pane 1 (right pane)
3. **Pane Numbering**: tmux panes are numbered starting from 0

### Manual Setup

```bash
# Create session
tmux new-session -d -s claude-bridge

# Split horizontally
tmux split-window -h -t claude-bridge

# Select the right pane (pane 1)
tmux select-pane -t claude-bridge:1
```

### Automated Setup Script

```bash
#!/bin/bash
# setup-tmux.sh

SESSION_NAME="claude-bridge"

# Check if session exists
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "Session $SESSION_NAME already exists"
    tmux attach-session -t $SESSION_NAME
else
    echo "Creating new tmux session: $SESSION_NAME"
    tmux new-session -d -s $SESSION_NAME
    tmux split-window -h -t $SESSION_NAME
    tmux select-pane -t $SESSION_NAME:0
    tmux attach-session -t $SESSION_NAME
fi
```

## Troubleshooting

### Common Issues

1. **"tmux session not found" error:**
   - Ensure tmux is running
   - Verify the session name matches your configuration
   - Check that the session has been created

2. **Commands not executing:**
   - Verify the pane number is correct
   - Ensure the target pane is not running another interactive program
   - Check tmux permissions

3. **Output not captured:**
   - The pane might be in copy mode
   - Check if there are blocking prompts in the terminal

### Debug Mode

Run with debug logging:

```bash
LOG_LEVEL=debug ./tmux-claude-bridge
```

### Health Check

Check if the service is running and tmux session is accessible:

```bash
curl http://localhost:8080/health
```

## Security Considerations

- **Local Access Only**: The WebSocket server should only be accessible locally
- **Command Validation**: Consider implementing command filtering for sensitive environments
- **Session Isolation**: Use dedicated tmux sessions for Claude interactions
- **Firewall Rules**: Ensure the port is not exposed to external networks

## Development

### Building from Source

```bash
go mod tidy
go build -o tmux-claude-bridge
```

### Running Tests

```bash
go test ./...
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Changelog

### v1.0.0
- Initial release
- WebSocket server implementation
- tmux integration
- Real-time output capture
- Command completion detection
- Health monitoring
- Configurable settings
