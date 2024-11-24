import { google } from 'googleapis';
import { AuthService } from '../auth/auth-service';
import { logger } from '../utils/logger';

interface EmailData {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  body: string;
  rawPayload?: any;
}

export class GmailService {
  private gmail;

  constructor(authService: AuthService) {
    this.gmail = google.gmail({ 
      version: 'v1', 
      auth: authService.getAuthClient() 
    });
  }
  
// limit 5 each
  async searchEmails(query: string, maxResults: number = 5): Promise<EmailData[]> {
    try {
      logger.info('Searching emails with query:', query);
      
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: maxResults
      });

      if (!response.data.messages) {
        logger.info('No emails found');
        return [];
      }

      const emails: EmailData[] = [];
      
      for (const message of response.data.messages) {
        const email = await this.getEmailById(message.id!);
        if (email) {
          emails.push(email);
        }
      }

      return emails;
    } catch (error) {
      logger.error('Error searching emails:', error);
      throw error;
    }
  }

  async getEmailById(messageId: string): Promise<EmailData | null> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      const headers = response.data.payload?.headers;
      const from = headers?.find(h => h.name === 'From')?.value || '';
      const subject = headers?.find(h => h.name === 'Subject')?.value || '';
      const date = headers?.find(h => h.name === 'Date')?.value || '';
      const body = this.getEmailBody(response.data.payload);

      return {
        id: response.data.id!,
        threadId: response.data.threadId!,
        from,
        subject,
        date,
        body,
        rawPayload: response.data.payload
      };
    } catch (error) {
      logger.error(`Error fetching email ${messageId}:`, error);
      return null;
    }
  }

  private getEmailBody(payload: any): string {
    if (!payload) return '';

    // Handle multipart messages
    if (payload.mimeType === 'multipart/alternative' && payload.parts) {
      // Try to find plain text version first
      const plainText = payload.parts.find((part: any) => 
        part.mimeType === 'text/plain'
      );
      
      if (plainText && plainText.body.data) {
        return Buffer.from(plainText.body.data, 'base64').toString();
      }

      // Fall back to HTML version
      const html = payload.parts.find((part: any) => 
        part.mimeType === 'text/html'
      );
      
      if (html && html.body.data) {
        return Buffer.from(html.body.data, 'base64').toString();
      }
    }

    // Handle single part messages
    if (payload.body && payload.body.data) {
      return Buffer.from(payload.body.data, 'base64').toString();
    }

    return '';
  }
}