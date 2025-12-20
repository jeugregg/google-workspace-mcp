/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This module acts as a drop-in replacement for the 'open' package.
 * It intercepts browser launch requests and either:
 * 1. Opens the browser securely using our secure-browser-launcher
 * 2. Prints the URL to console if browser launch should be skipped or fails
 */

import { openBrowserSecurely, shouldLaunchBrowser } from './secure-browser-launcher';

// Create a mock child process object that matches what open returns
const createMockChildProcess = () => ({
  unref: () => {},
  ref: () => {},
  pid: 123,
  stdout: null,
  stderr: null,
  stdin: null,
  channel: null,
  connected: false,
  exitCode: 0,
  killed: false,
  signalCode: null,
  spawnargs: [],
  spawnfile: '',
});

const openWrapper = async (url: string): Promise<any> => {
  console.error('\n[OPEN-WRAPPER] Called with URL:', url.substring(0, 50) + '...');

  // Check if we should launch the browser
  if (!shouldLaunchBrowser()) {
    console.error('[OPEN-WRAPPER] Browser launch not supported');
    console.log(`Browser launch not supported. Please open this URL in your browser:\n${url}`);
    console.error('ERROR: Browser launch conditions not met. Cannot proceed with authentication.');
    throw new Error('Browser launch not supported in this environment');
  }

  console.error('[OPEN-WRAPPER] Attempting to open browser securely...');

  // Try to open the browser securely
  try {
    await openBrowserSecurely(url);
    console.error('[OPEN-WRAPPER] Browser opened successfully');
    return createMockChildProcess();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[OPEN-WRAPPER] Browser opening failed: ${errorMsg}`);
    console.error(`\n❌ Failed to open browser: ${errorMsg}`);
    console.error(`\nPlease open this URL manually in your browser:\n${url}`);
    throw new Error(`Browser opening failed: ${errorMsg}`);
  }
};

// Use standard ES Module export and let the compiler generate the CommonJS correct output.
export default openWrapper;