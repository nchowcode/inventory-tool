import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as path from 'path';

// Path to your downloaded credentials file
const CREDENTIALS_PATH = path.join(process.cwd(), 'client_secret.json');

export async function getGmailClient() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,  // Use the JSON file directly
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.labels',
        'https://www.googleapis.com/auth/pubsub'
      ]
    });

    const client = await auth.getClient();
    return google.gmail({ version: 'v1', auth: client });
  } catch (error) {
    console.error('Error initializing Gmail client:', error);
    throw error;
  }
}