import { google } from 'googleapis';
import { AuthService } from '../auth/auth-service';
import { logger } from '../utils/logger';

// Types for order-related data
interface EmailData {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  body: string;
  vendor?: string;
  orderNumber?: string;
  isOrderEmail: boolean;
}

interface OrderDetails {
  orderNumber?: string;
  vendor?: string;
  items?: Array<{
    name?: string;
    quantity?: number;
    price?: number;
  }>;
  total?: number;
}

export class GmailService {
  private gmail;
  private readonly ORDER_KEYWORDS = [
    'order confirmation',
    'order number',
    'purchase confirmation',
    'your order',
    'order details',
    'order receipt'
  ];

  private readonly VENDOR_DOMAINS = [
    'amazon.com',
    'nike.com',
    'ticketmaster.com',
    // Add more vendor domains as needed
  ];

  constructor(authService: AuthService) {
    this.gmail = google.gmail({ 
      version: 'v1', 
      auth: authService.getAuthClient() 
    });
  }

  async listOrderEmails(): Promise<EmailData[]> {
    try {
      // Create search query for order-related emails
      const searchQuery = this.ORDER_KEYWORDS.map(keyword => `subject:"${keyword}"`).join(' OR ');
      
      logger.info('Searching for order emails with query:', searchQuery);

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: `(${searchQuery}) is:unread`
      });

      if (!response.data.messages) {
        logger.info('No order emails found');
        return [];
      }

      // Get details for each email
      const emails: EmailData[] = [];
      for (const message of response.data.messages) {
        const email = await this.getEmailData(message.id!);
        if (email && email.isOrderEmail) {
          emails.push(email);
        }
      }

      logger.info(`Found ${emails.length} order-related emails`);
      return emails;

    } catch (error) {
      logger.error('Failed to list order emails:', error);
      throw error;
    }
  }

  private async getEmailData(messageId: string): Promise<EmailData | null> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      const headers = response.data.payload?.headers;
      const subject = headers?.find(h => h.name === 'Subject')?.value || '';
      const from = headers?.find(h => h.name === 'From')?.value || '';
      const date = headers?.find(h => h.name === 'Date')?.value || '';
      const body = this.getEmailBody(response.data.payload);

      // Determine if this is an order email
      const isOrderEmail = this.isOrderEmail(subject, body);
      
      // Get vendor and order information if it's an order email
      const orderDetails = isOrderEmail ? this.extractOrderDetails(subject, body, from) : {};

      return {
        id: response.data.id!,
        threadId: response.data.threadId!,
        subject,
        from,
        date,
        body,
        isOrderEmail,
        ...orderDetails
      };

    } catch (error) {
      logger.error(`Failed to get email ${messageId}:`, error);
      return null;
    }
  }

  private isOrderEmail(subject: string, body: string): boolean {
    const textToCheck = `${subject.toLowerCase()} ${body.toLowerCase()}`;
    
    // Check for order-related keywords
    return this.ORDER_KEYWORDS.some(keyword => 
      textToCheck.includes(keyword.toLowerCase())
    );
  }

  private extractOrderDetails(subject: string, body: string, from: string): OrderDetails {
    const details: OrderDetails = {};

    // Extract vendor
    const vendorMatch = this.VENDOR_DOMAINS.find(domain => 
      from.toLowerCase().includes(domain)
    );
    if (vendorMatch) {
      details.vendor = vendorMatch;
    }

    // Extract order number using various patterns
    const orderPatterns = [
      /order[:\s#]+(\w{5,})/i,           // General order number pattern
      /order number[:\s#]+(\w{5,})/i,     // "Order number" pattern
      /#\s*(\w{5,})/,                     // # followed by numbers/letters
      /confirmation[:\s#]+(\w{5,})/i      // Confirmation number pattern
    ];

    for (const pattern of orderPatterns) {
      const match = subject.match(pattern) || body.match(pattern);
      if (match) {
        details.orderNumber = match[1];
        break;
      }
    }

    return details;
  }

  private getEmailBody(payload: any): string {
    if (!payload) return '';

    if (payload.mimeType === 'multipart/alternative' && payload.parts) {
      const plainText = payload.parts.find((part: any) => 
        part.mimeType === 'text/plain'
      );
      
      if (plainText && plainText.body.data) {
        return Buffer.from(plainText.body.data, 'base64').toString();
      }
    }

    if (payload.body && payload.body.data) {
      return Buffer.from(payload.body.data, 'base64').toString();
    }

    return '';
  }

  async markAsProcessed(messageId: string): Promise<void> {
    try {
      // Add a label and mark as read
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD'],
          addLabelIds: ['PROCESSED'] // Note: You need to create this label first
        }
      });
      logger.info(`Marked email ${messageId} as processed`);
    } catch (error) {
      logger.error(`Failed to mark email ${messageId} as processed:`, error);
      throw error;
    }
  }
}