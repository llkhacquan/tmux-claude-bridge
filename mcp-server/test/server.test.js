import { test } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'child_process';

test('MCP server syntax validation', async (t) => {
  // Test that the server file has valid syntax
  try {
    execSync('node --check server.js', { 
      cwd: './mcp-server',
      stdio: 'pipe' 
    });
    assert.ok(true, 'Server syntax is valid');
  } catch (error) {
    assert.fail(`Server syntax error: ${error.message}`);
  }
});

test('Package.json validation', async (t) => {
  // Test that package.json is valid
  try {
    const pkg = JSON.parse(execSync('cat package.json', { 
      cwd: './mcp-server',
      encoding: 'utf8' 
    }));
    
    assert.ok(pkg.name, 'Package has name');
    assert.ok(pkg.version, 'Package has version');
    assert.ok(pkg.main, 'Package has main entry');
    assert.ok(pkg.bin, 'Package has bin entry');
    assert.ok(pkg.dependencies, 'Package has dependencies');
  } catch (error) {
    assert.fail(`Package.json validation failed: ${error.message}`);
  }
});

test('Required dependencies check', async (t) => {
  // Check if all required dependencies are installable
  const requiredDeps = [
    '@modelcontextprotocol/sdk',
    'ws',
    'uuid'
  ];
  
  try {
    const pkg = JSON.parse(execSync('cat package.json', { 
      cwd: './mcp-server',
      encoding: 'utf8' 
    }));
    
    for (const dep of requiredDeps) {
      assert.ok(
        pkg.dependencies[dep], 
        `Required dependency ${dep} is listed`
      );
    }
  } catch (error) {
    assert.fail(`Dependency check failed: ${error.message}`);
  }
});