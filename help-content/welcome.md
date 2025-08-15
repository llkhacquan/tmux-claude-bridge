# 🚀 Tmux Terminal MCP - Claude Integration Guide

## What is this MCP?
This MCP enables Claude to execute commands in a dedicated tmux pane called "Claude Terminal (CT Pane)". It provides intelligent command execution with automatic timeout handling and background monitoring.

## Core Concept: Claude Terminal (CT Pane)
- 🎯 **Dedicated Pane**: Commands run in a separate tmux pane for isolation
- 🔄 **Fire and Wait Briefly**: Quick commands get immediate results, long commands run in background
- 📊 **Smart Detection**: Automatically detects command types and appropriate timeouts
- 🤖 **Process Monitoring**: Uses process PIDs for reliable completion detection