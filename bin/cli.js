#!/usr/bin/env node

/**
 * CLI entry point for @presto-ai/google-workspace-mcp
 *
 * Modes:
 * - npx @presto-ai/google-workspace-mcp --auth    : Interactive authentication
 * - npx @presto-ai/google-workspace-mcp           : Start MCP server (default)
 */

async function main() {
  const args = process.argv.slice(2);

  // Check for --auth flag
  if (args.includes('--auth')) {
    console.log('🔐 Starting Google Workspace MCP authentication...\n');
    const { runAuthFlow } = require('../dist/auth-flow');
    await runAuthFlow();
  } else {
    // Default: Start MCP server
    // The server startup is automatic when index.js is required
    // (it calls startMCPServer() at module load time)
    require('../dist/index');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
