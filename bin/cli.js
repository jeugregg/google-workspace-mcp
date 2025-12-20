#!/usr/bin/env node

/**
 * CLI entry point for @presto-ai/google-workspace-mcp
 *
 * Modes:
 * - npx @presto-ai/google-workspace-mcp --auth    : Explicit authentication
 * - npx @presto-ai/google-workspace-mcp           : Start MCP server (default)
 *
 * Auto-authentication:
 * If credentials don't exist and the terminal is interactive,
 * automatically prompts the user to authenticate before starting the server.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Determines the config directory for credentials
 * (mirrors logic in src/utils/paths.ts)
 */
function getConfigDirectory() {
  const homeDir = os.homedir();

  if (process.env.GOOGLE_WORKSPACE_MCP_HOME) {
    return process.env.GOOGLE_WORKSPACE_MCP_HOME;
  }

  switch (process.platform) {
    case 'win32':
      return path.join(
        process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'),
        'google-workspace-mcp',
      );
    case 'darwin':
    case 'linux':
    default:
      return path.join(homeDir, '.config', 'google-workspace-mcp');
  }
}

/**
 * Checks if valid credentials exist
 */
function hasValidCredentials() {
  try {
    const configDir = getConfigDirectory();
    const tokenPath = path.join(configDir, 'token.json');
    return fs.existsSync(tokenPath);
  } catch {
    return false;
  }
}

/**
 * Checks if the terminal is interactive
 * (can prompt the user for input)
 */
function isInteractiveTerminal() {
  return process.stdin.isTTY && process.stdout.isTTY;
}

async function main() {
  const args = process.argv.slice(2);

  // Explicit --auth flag always runs auth flow
  if (args.includes('--auth')) {
    console.log('🔐 Starting Google Workspace MCP authentication...\n');
    const { runAuthFlow } = require('../dist/auth-flow');
    await runAuthFlow();
    return;
  }

  // Check if credentials exist
  if (!hasValidCredentials()) {
    // No credentials found
    if (isInteractiveTerminal()) {
      // Interactive terminal: auto-prompt for authentication
      console.log('🔐 No credentials found. Starting authentication...\n');
      const { runAuthFlow } = require('../dist/auth-flow');
      try {
        await runAuthFlow();
        // After successful auth, continue to start server
        console.log('\nStarting Google Workspace MCP server...\n');
      } catch (error) {
        // Auth failed, exit
        process.exit(1);
      }
    } else {
      // Non-interactive terminal (CI, Docker, etc.)
      console.error('❌ No valid credentials found.\n');
      console.error('For automated/non-interactive environments:');
      console.error('1. Run authentication on an interactive machine:');
      console.error('   npx @presto-ai/google-workspace-mcp --auth\n');
      console.error('2. Copy credentials to your environment:');
      console.error('   macOS/Linux: ~/.config/google-workspace-mcp/');
      console.error('   Windows: %APPDATA%/google-workspace-mcp/\n');
      console.error('3. Or set GOOGLE_WORKSPACE_MCP_HOME to credentials location\n');
      process.exit(1);
    }
  }

  // Default: Start MCP server
  // The server startup is automatic when index.js is required
  // (it calls startMCPServer() at module load time)
  require('../dist/index');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
