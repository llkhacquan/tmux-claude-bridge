# Key Features

## Automatic Command Classification
- **Quick Commands**: `ls`, `pwd`, `git status` - immediate results
- **Build Commands**: `npm install`, `make`, `cargo build` - background with monitoring
- **Interactive Tools**: `vim`, `top`, `htop` - switches focus automatically
- **Password Prompts**: `sudo` commands - switches focus for secure input

## Smart Timeout Strategy
- Quick commands: 3-5 seconds
- Package managers: 2+ minutes in background
- Build tools: Background monitoring
- Interactive/long-running: Immediate focus switch

## Reliable Completion Detection
Uses tmux process PID monitoring instead of fragile regex patterns for accurate command completion detection.