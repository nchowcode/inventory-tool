import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { exec } from 'child_process';
import { logger } from '../utils/logger';

export class AuthService {
  private oauth2Client: OAuth2Client;
  private readonly CREDENTIALS_PATH = path.join(process.cwd(), 'credentials', 'client_secret.json');
  private readonly TOKEN_PATH = path.join(process.cwd(), 'credentials', 'token.json');

  constructor() {
    if (!fs.existsSync(this.CREDENTIALS_PATH)) {
      throw new Error('client_secret.json not found in credentials folder');
    }

    const credentials = require(this.CREDENTIALS_PATH);
    
    this.oauth2Client = new google.auth.OAuth2(
      credentials.installed.client_id,
      credentials.installed.client_secret,
      'http://localhost:3000/oauth2callback'
    );

    // Load token if it exists
    if (fs.existsSync(this.TOKEN_PATH)) {
      const token = require(this.TOKEN_PATH);
      this.oauth2Client.setCredentials(token);
    }
  }

  async ensureAuthenticated(): Promise<void> {
    try {
      // Check if we have valid credentials
      if (!fs.existsSync(this.TOKEN_PATH)) {
        logger.info('No token found. Starting authentication flow...');
        await this.authenticate();
        return;
      }

      // Verify token is still valid
      try {
        const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
        await gmail.users.labels.list({ userId: 'me' });
        logger.info('Existing token is valid');
      } catch (error) {
        logger.info('Token invalid or expired. Starting authentication flow...');
        await this.authenticate();
      }
    } catch (error) {
      logger.error('Authentication failed:', error);
      throw error;
    }
  }

  private async authenticate(): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url!, `http://${req.headers.host}`);
          const code = url.searchParams.get('code');

          if (code) {
            const { tokens } = await this.oauth2Client.getToken(code);
            this.oauth2Client.setCredentials(tokens);

            // Save token
            fs.writeFileSync(this.TOKEN_PATH, JSON.stringify(tokens, null, 2));
            logger.success('Authentication successful! Token saved.');

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Authentication successful!</h1><p>You can close this window.</p>');
            
            server.close();
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      }).listen(3000);

      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/gmail.labels'
        ],
        prompt: 'consent'
      });

      logger.info('Opening browser for authentication...');
      this.openBrowser(authUrl);
    });
  }

  private openBrowser(url: string) {
    switch (process.platform) {
      case 'darwin':
        exec(`open "${url}"`);
        break;
      case 'win32':
        exec(`start "${url}"`);
        break;
      default:
        exec(`xdg-open "${url}"`);
    }
  }

  getAuthClient(): OAuth2Client {
    return this.oauth2Client;
  }
}