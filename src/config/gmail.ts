import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';

// Path to credentials file
const CREDENTIALS_PATH = path.join(process.cwd(), 'client_secret.json');

// Scopes we need for Gmail
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels'
];

class GmailService {
    private oauth2Client: OAuth2Client;
    private readonly CREDENTIALS_PATH = path.join(process.cwd(), 'credentials', 'client_secret.json');
    private readonly TOKEN_PATH = path.join(process.cwd(), 'credentials', 'oauth_token.json');
  
    constructor() {
      try {
        if (!fs.existsSync(this.CREDENTIALS_PATH)) {
          throw new Error('No client_secret.json found');
        }
  
        const credentials = JSON.parse(fs.readFileSync(this.CREDENTIALS_PATH, 'utf-8'));
        
        this.oauth2Client = new OAuth2Client(
          credentials.installed.client_id,
          credentials.installed.client_secret,
          credentials.installed.redirect_uris[0]
        );
  
        // Load token if exists
        if (fs.existsSync(this.TOKEN_PATH)) {
          const token = JSON.parse(fs.readFileSync(this.TOKEN_PATH, 'utf-8'));
          this.oauth2Client.setCredentials(token);
        } else {
          throw new Error('No OAuth token found. Please run: npx ts-node src/auth/auth-service.ts');
        }
  
        logger.info('Gmail service initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize Gmail service:', error);
        throw error;
      }
    }

  async getGmailClient() {
    try {
      // Initialize the Gmail API client
      const gmail = google.gmail({
        version: 'v1',
        auth: this.oauth2Client
      });

      return gmail;
    } catch (error) {
      logger.error('Error getting Gmail client:', error);
      throw error;
    }
  }

  async setupWatch(topicName: string) {
    try {
      const gmail = await this.getGmailClient();
      
      const response = await gmail.users.watch({
        userId: 'me',
        requestBody: {
          labelIds: ['INBOX'],
          topicName: `projects/${process.env.GOOGLE_PROJECT_ID}/topics/${topicName}`
        }
      });

      logger.info('Gmail watch setup successful:', response.data);
      return response.data;
    } catch (error) {
      logger.error('Failed to setup Gmail watch:', error);
      throw error;
    }
  }

  async getEmail(messageId: string) {
    try {
      const gmail = await this.getGmailClient();
      
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to get email:', error);
      throw error;
    }
  }

  async listLabels() {
    try {
      const gmail = await this.getGmailClient();
      
      const response = await gmail.users.labels.list({
        userId: 'me'
      });

      return response.data.labels;
    } catch (error) {
      logger.error('Failed to list labels:', error);
      throw error;
    }
  }

  async modifyLabels(messageId: string, addLabels: string[], removeLabels: string[] = []) {
    try {
      const gmail = await this.getGmailClient();
      
      const response = await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: addLabels,
          removeLabelIds: removeLabels
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to modify labels:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const gmailService = new GmailService();