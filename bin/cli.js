#!/usr/bin/env node

const { runAuthFlow } = require('../dist/auth-flow');
const { startMCPServer } = require('../dist/index');

async function main() {
  const args = process.argv.slice(2);

  // Check for --auth flag
  if (args.includes('--auth')) {
    console.log('🔐 Starting Google Workspace MCP authentication...\n');
    await runAuthFlow();
  } else {
    // Default: Start MCP server
    await startMCPServer();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
