/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { google, Auth } from 'googleapis';
import crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as net from 'node:net';
import * as url from 'node:url';
import { logToFile } from '../utils/logger';
import open from '../utils/open-wrapper';
import { shouldLaunchBrowser } from '../utils/secure-browser-launcher';
import { OAuthCredentialStorage } from './token-storage/oauth-credential-storage';
import { loadConfig } from '../utils/config';

const config = loadConfig();
const CLIENT_ID = config.clientId;
const CLOUD_FUNCTION_URL = config.cloudFunctionUrl;
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
const AUTH_URL_FILE = '/tmp/auth_url.txt';

interface OauthWebLogin {
  authUrl: string;
  loginCompletePromise: Promise<void>;
}

export class AuthManager {
  private client: Auth.OAuth2Client | null = null;
  private scopes: string[];
  private onStatusUpdate: ((message: string) => void) | null = null;

  constructor(scopes: string[]) {
    this.scopes = scopes;
  }

  public setOnStatusUpdate(callback: (message: string) => void) {
    this.onStatusUpdate = callback;
  }

  private isTokenExpiringSoon(credentials: Auth.Credentials): boolean {
    return !!(
      credentials.expiry_date &&
      credentials.expiry_date < Date.now() + TOKEN_EXPIRY_BUFFER_MS
    );
  }

  private async loadCachedCredentials(
    client: Auth.OAuth2Client,
  ): Promise<boolean> {
    const credentials = await OAuthCredentialStorage.loadCredentials();

    if (credentials) {
      const savedScopes = new Set(credentials.scope?.split(' ') ?? []);
      logToFile(`Cached token has scopes: ${[...savedScopes].join(', ')}`);
      logToFile(`Required scopes: ${this.scopes.join(', ')}`);

      const missingScopes = this.scopes.filter(
        (scope) => !savedScopes.has(scope),
      );

      if (missingScopes.length > 0) {
        logToFile(`Token cache missing required scopes: ${missingScopes.join(', ')}`);
        logToFile('Removing cached token to force re-authentication...');
        await OAuthCredentialStorage.clearCredentials();
        return false;
      } else {
        client.setCredentials(credentials);
        return true;
      }
    }

    return false;
  }

  public async getAuthenticatedClient(): Promise<Auth.OAuth2Client> {
    logToFile('getAuthenticatedClient called');

    if (
      this.client &&
      this.client.credentials &&
      this.client.credentials.refresh_token
    ) {
      logToFile('Returning existing cached client with valid credentials');
      const isExpired = this.isTokenExpiringSoon(this.client.credentials);
      logToFile(`Token expired: ${isExpired}`);

      if (isExpired) {
        logToFile('Token is expired, refreshing proactively...');
        try {
          await this.refreshToken();
          logToFile('Token refreshed successfully');
        } catch (error) {
          logToFile(`Failed to refresh token: ${error}`);
          this.client = null;
          await OAuthCredentialStorage.clearCredentials();
        }
      }

      if (this.client) {
        return this.client;
      }
    }

    const options: Auth.OAuth2ClientOptions = {
      clientId: CLIENT_ID,
    };
    const oAuth2Client = new google.auth.OAuth2(options);

    oAuth2Client.on('tokens', async (tokens) => {
      logToFile('Tokens refreshed event received');
      try {
        const current = (await OAuthCredentialStorage.loadCredentials()) || {};
        const merged = {
          ...tokens,
          refresh_token: tokens.refresh_token || current.refresh_token,
        };
        await OAuthCredentialStorage.saveCredentials(merged);
        logToFile('Credentials saved after refresh');
      } catch (e) {
        logToFile(`Error saving refreshed credentials: ${e}`);
      }
    });

    logToFile('No valid cached client, checking for saved credentials...');
    if (await this.loadCachedCredentials(oAuth2Client)) {
      logToFile('Loaded saved credentials, caching and returning client');
      this.client = oAuth2Client;

      const isExpired = this.isTokenExpiringSoon(this.client.credentials);
      if (isExpired) {
        logToFile('Loaded token is expired, refreshing proactively...');
        try {
          await this.refreshToken();
          logToFile('Token refreshed successfully after loading from storage');
        } catch (error) {
          logToFile(`Failed to refresh loaded token: ${error}`);
          this.client = null;
          await OAuthCredentialStorage.clearCredentials();
        }
      }

      if (this.client) {
        return this.client;
      }
    }

    const webLogin = await this.authWithWeb(oAuth2Client);

    // FIX 1 : Écrit l'URL dans un fichier lisible même en headless
    try {
      fs.writeFileSync(AUTH_URL_FILE, webLogin.authUrl + '\n');
      logToFile(`Auth URL written to ${AUTH_URL_FILE}`);
    } catch (e) {
      logToFile(`Could not write auth URL to file: ${e}`);
    }

    // FIX 2 : Affiche l'URL clairement dans stderr même sans browser
    console.error('\n\n🔐 ===== AUTHENTIFICATION REQUISE =====');
    console.error(`👉 Ouvre ce lien dans ton navigateur :\n\n${webLogin.authUrl}\n`);
    console.error(`📁 URL aussi disponible dans : ${AUTH_URL_FILE}`);
    console.error('======================================\n');

    // FIX 3 : Tente d'ouvrir le browser mais ne crashe pas si X11 absent
    try {
      await open(webLogin.authUrl);
    } catch (e) {
      logToFile(`Could not open browser (headless mode): ${e}`);
    }

    const msg = 'Waiting for authentication... Check your browser or open the URL above.';
    logToFile(msg);
    if (this.onStatusUpdate) {
      this.onStatusUpdate(msg);
    }

    const authTimeout = 5 * 60 * 1000;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            'Authentication timed out after 5 minutes. ' +
            `Open this URL in your browser: ${webLogin.authUrl}`,
          ),
        );
      }, authTimeout);
    });

    await Promise.race([webLogin.loginCompletePromise, timeoutPromise]);

    await OAuthCredentialStorage.saveCredentials(oAuth2Client.credentials);
    this.client = oAuth2Client;
    return this.client;
  }

  public async clearAuth(): Promise<void> {
    logToFile('Clearing authentication...');
    this.client = null;
    await OAuthCredentialStorage.clearCredentials();
    // FIX 4 : Nettoie aussi le fichier d'URL temporaire
    try { fs.unlinkSync(AUTH_URL_FILE); } catch (_) {}
    logToFile('Authentication cleared.');
  }

  public async refreshToken(): Promise<void> {
    logToFile('Manual token refresh triggered');
    if (!this.client) {
      logToFile('No client available to refresh, getting new client');
      this.client = await this.getAuthenticatedClient();
    }
    try {
      const currentCredentials = { ...this.client.credentials };

      if (!currentCredentials.refresh_token) {
        throw new Error('No refresh token available');
      }

      logToFile('Calling cloud function to refresh token...');

      const response = await fetch(`${CLOUD_FUNCTION_URL}/refreshToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: currentCredentials.refresh_token }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
      }

      const newTokens = await response.json();
      const mergedCredentials = {
        ...newTokens,
        refresh_token: currentCredentials.refresh_token,
      };

      this.client.setCredentials(mergedCredentials);
      await OAuthCredentialStorage.saveCredentials(mergedCredentials);
      logToFile('Token refreshed and saved successfully via cloud function');
    } catch (error) {
      logToFile(`Error during token refresh: ${error}`);
      throw error;
    }
  }

  private async getAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      try {
        const portStr = process.env['OAUTH_CALLBACK_PORT'];
        if (portStr) {
          const port = parseInt(portStr, 10);
          if (isNaN(port) || port <= 0 || port > 65535) {
            return reject(new Error(`Invalid value for OAUTH_CALLBACK_PORT: "${portStr}"`));
          }
          return resolve(port);
        }
        const server = net.createServer();
        let port = 0;
        server.listen(0, () => {
          port = (server.address()! as net.AddressInfo).port;
        });
        server.on('listening', () => { server.close(); server.unref(); });
        server.on('error', (e) => reject(e));
        server.on('close', () => resolve(port));
      } catch (e) {
        reject(e);
      }
    });
  }

  private async authWithWeb(client: Auth.OAuth2Client): Promise<OauthWebLogin> {
    logToFile(`Requesting authentication with scopes: ${this.scopes.join(', ')}`);

    const port = await this.getAvailablePort();
    const host = process.env['OAUTH_CALLBACK_HOST'] || 'localhost';
    const localRedirectUri = `http://${host}:${port}/oauth2callback`;
    const isGuiAvailable = shouldLaunchBrowser();

    const csrfToken = crypto.randomBytes(32).toString('hex');
    const statePayload = {
      uri: isGuiAvailable ? localRedirectUri : undefined,
      manual: !isGuiAvailable,
      csrf: csrfToken,
    };
    const state = Buffer.from(JSON.stringify(statePayload)).toString('base64');

    const authUrl = client.generateAuthUrl({
      redirect_uri: CLOUD_FUNCTION_URL,
      access_type: 'offline',
      scope: this.scopes,
      state: state,
      prompt: 'consent',
    });

    const loginCompletePromise = new Promise<void>((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        try {
          if (!req.url || !req.url.startsWith('/oauth2callback')) {
            res.end();
            reject(new Error('OAuth callback not received. Unexpected request: ' + req.url));
            return;
          }

          const qs = new url.URL(req.url, `http://${host}:${port}`).searchParams;

          // FIX 5 : CSRF check robuste — gère les deux cas (csrf brut OU base64 JSON)
          const returnedState = qs.get('state');
          let csrfValid = returnedState === csrfToken;
          if (!csrfValid && returnedState) {
            try {
              const decoded = JSON.parse(Buffer.from(returnedState, 'base64').toString());
              csrfValid = decoded.csrf === csrfToken;
            } catch (_) {}
          }
          if (!csrfValid) {
            res.end('State mismatch. Possible CSRF attack.');
            reject(new Error('OAuth state mismatch. Possible CSRF attack.'));
            return;
          }

          if (qs.get('error')) {
            res.end();
            reject(new Error(`Google OAuth error: ${qs.get('error')}. ${qs.get('error_description') || ''}`));
            return;
          }

          const access_token = qs.get('access_token');
          const refresh_token = qs.get('refresh_token');
          const expiry_date_str = qs.get('expiry_date');

          if (access_token && expiry_date_str) {
            const tokens: Auth.Credentials = {
              access_token,
              refresh_token: refresh_token || null,
              scope: qs.get('scope') || undefined,
              token_type: (qs.get('token_type') as 'Bearer') || undefined,
              expiry_date: parseInt(expiry_date_str, 10),
            };
            client.setCredentials(tokens);
            res.end('Authentication successful! Please return to the console.');
            resolve();
          } else {
            reject(new Error('Authentication failed: Did not receive tokens from callback.'));
          }
        } catch (e) {
          reject(e);
        } finally {
          server.close();
        }
      });

      server.listen(port, host, () => {});
      server.on('error', (err) => reject(new Error(`OAuth callback server error: ${err}`)));
    });

    return { authUrl, loginCompletePromise };
  }
}
