import { AuthService } from '../auth/auth-service';
import { GmailService } from '../config/gmail';
import { SmartParser } from '../parsers/smart-parser';
import { logger } from '../utils/logger';

export class EmailProcessor {
  private parser: SmartParser;

  constructor(private gmailService: GmailService) {
    this.parser = new SmartParser();
  }

  async processEmails() {
    try {
      const searchQuery = 'from:auto-confirm@amazon.com subject: "Your Amazon.com order of"';
      logger.info(`Testing search with query: ${searchQuery}`);
  
      const emails = await this.gmailService.searchEmails(searchQuery, 10);
      logger.info(`Found ${emails.length} emails to process`);
  
      const parsedOrders = [];
  
      for (const email of emails) {
        logger.info('\nProcessing email:', {
          from: email.from,
          subject: email.subject,
        });
  
        const parsedOrder = await this.parser.parseEmail(
          email.from,
          email.subject,
          email.body
        );
  
        if (parsedOrder) {
          logger.info('Successfully parsed order:', {
            orderNumber: parsedOrder.orderNumber,
            vendor: parsedOrder.vendor,
            itemCount: parsedOrder.items.length,
            items: parsedOrder.items
          });
          parsedOrders.push(parsedOrder);
        } else {
          logger.warn('Failed to parse email:', {
            subject: email.subject
          });
        }
      }
  
      logger.info(`\nSummary: Parsed ${parsedOrders.length} orders out of ${emails.length} emails`);
      if (parsedOrders.length > 0) {
        logger.info('Parsed orders:', JSON.stringify(parsedOrders, null, 2));
      }
  
      return parsedOrders;
    } catch (error) {
      logger.error('Error processing emails:', error);
      throw error;
    }
  }
}