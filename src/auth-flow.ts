/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthManager } from './auth/AuthManager';
import { logToFile } from './utils/logger';

const SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/chat.spaces',
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/chat.memberships',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/directory.readonly',
  'https://www.googleapis.com/auth/presentations.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];

/**
 * Runs the interactive authentication flow.
 *
 * Opens the browser, collects user authorization, and saves credentials
 * to persistent storage (~/.config/google-workspace-mcp on Unix).
 */
export async function runAuthFlow(): Promise<void> {
  try {
    const authManager = new AuthManager(SCOPES);

    console.log('Opening browser for Google authentication...');
    console.log('Please log in and grant the requested permissions.\n');

    logToFile('Starting authentication flow');

    // Force re-authentication to get fresh credentials
    // This will open the browser automatically
    const client = await authManager.getAuthenticatedClient();

    // Verify that credentials were actually obtained
    if (!client) {
      throw new Error('Failed to obtain authenticated client - no client returned');
    }

    logToFile('Successfully obtained authenticated client');

    console.log('\n✅ Authentication successful!');
    console.log('Tokens have been saved securely.');
    console.log(
      '\nYou can now use this server with your MCP client:',
    );
    console.log('  npx -y @presto-ai/google-workspace-mcp\n');

    logToFile('Authentication flow completed successfully');
    process.exit(0);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logToFile(`Authentication failed: ${errorMsg}`);
    console.error('\n❌ Authentication failed. Please try again.');
    console.error(`Error: ${errorMsg}\n`);
    console.error('Troubleshooting:');
    console.error('1. Make sure your browser window opened (check taskbar/dock)');
    console.error('2. Check logs at: ~/.config/google-workspace-mcp/logs/');
    console.error('');
    process.exit(1);
  }
}
