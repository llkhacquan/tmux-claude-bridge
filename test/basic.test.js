#!/usr/bin/env node

/**
 * Basic tests for the Tmux Terminal MCP Server
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { TmuxManager } from '../tmux-manager.js';
import { CommandDetector } from '../command-detector.js';

test('TmuxManager - cleanOutput removes ANSI sequences', () => {
  const tmux = new TmuxManager();
  const input = '\x1b[31mred text\x1b[0m\nline 2\r\n';
  const expected = 'red text\nline 2';
  
  assert.equal(tmux.cleanOutput(input), expected);
});

test('TmuxManager - isCommandComplete detects shell prompts', () => {
  const tmux = new TmuxManager();
  
  assert.equal(tmux.isCommandComplete('user@host:~$ '), true);
  assert.equal(tmux.isCommandComplete('root@host:/# '), true);
  assert.equal(tmux.isCommandComplete('user@host project % '), true);
  assert.equal(tmux.isCommandComplete('running command...'), false);
  assert.equal(tmux.isCommandComplete(''), false);
});

test('TmuxManager - detectInteractivePrompts identifies prompts', () => {
  const tmux = new TmuxManager();
  
  assert.equal(tmux.detectInteractivePrompts('Enter password: '), true);
  assert.equal(tmux.detectInteractivePrompts('Continue? [y/n]'), true);
  assert.equal(tmux.detectInteractivePrompts('[sudo] password for user: '), true);
  assert.equal(tmux.detectInteractivePrompts('regular output'), false);
});

test('CommandDetector - analyzeCommand identifies long-running commands', () => {
  const detector = new CommandDetector();
  
  const analysis1 = detector.analyzeCommand('npm install');
  assert.equal(analysis1.isLongRunning, true);
  assert.equal(analysis1.category, 'package-manager');
  
  const analysis2 = detector.analyzeCommand('ls -la');
  assert.equal(analysis2.isLongRunning, false);
  assert.equal(analysis2.category, 'file-system');
});

test('CommandDetector - analyzeCommand identifies interactive commands', () => {
  const detector = new CommandDetector();
  
  const analysis1 = detector.analyzeCommand('sudo apt update');
  assert.equal(analysis1.isInteractive, true);
  assert.equal(analysis1.requiresSudo, true);
  
  const analysis2 = detector.analyzeCommand('vim file.txt');
  assert.equal(analysis2.isInteractive, true);
  assert.equal(analysis2.special?.editor, true);
});

test('CommandDetector - getTimeoutStrategy provides correct strategies', () => {
  const detector = new CommandDetector();
  
  const strategy1 = detector.getTimeoutStrategy('npm install');
  assert.equal(strategy1.strategy, 'async');
  
  const strategy2 = detector.getTimeoutStrategy('ls -la');
  assert.equal(strategy2.strategy, 'quick');
  
  const strategy3 = detector.getTimeoutStrategy('sudo vim file.txt');
  assert.equal(strategy3.strategy, 'no-timeout');
});

test('CommandDetector - estimateDuration provides reasonable estimates', () => {
  const detector = new CommandDetector();
  
  assert.ok(detector.estimateDuration('npm install') >= 600);
  assert.ok(detector.estimateDuration('make') >= 180);
  assert.ok(detector.estimateDuration('ls -la') <= 5);
});

console.log('🧪 Running basic tests...');