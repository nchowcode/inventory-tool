import { WhitelistConfig, ParsedEmail } from './types';
import { logger } from '../utils/logger';

export class EmailParser {
  private whitelist: WhitelistConfig;

  constructor(whitelist?: WhitelistConfig) {
    this.whitelist = whitelist || {
      subjects: ['order', 'confirmation', 'invoice'],
      senders: [],
      forwarders: [],
      keywords: ['order', 'purchase']
    };
  }

  async parseEmail(emailData: any): Promise<ParsedEmail> {
    try {
      logger.info('Starting to parse email');

      // Extract email body
      const body = this.getEmailBody(emailData.payload);
      
      // Get headers
      const headers = emailData.payload?.headers || [];
      const subject = this.getHeader(headers, 'Subject');
      const from = this.getHeader(headers, 'From');
      const date = this.getHeader(headers, 'Date');

      // Check if this is a forwarded email
      const isForwarded = subject.toLowerCase().includes('fwd:');

      // Parse out meaningful data
      const orderNumber = this.extractOrderNumber(subject, body);
      const vendor = this.extractVendor(from, body, isForwarded);
      const items = this.extractItems(body);
      const total = this.extractTotal(body);

      const parsedEmail: ParsedEmail = {
        messageId: emailData.id,
        subject,
        from,
        receivedDate: new Date(date),
        isForwarded,
        originalSender: isForwarded ? this.extractOriginalSender(body) : from,
        parsedData: {
          orderNumber,
          vendor,
          items,
          total,
          confidence: this.calculateConfidence({ orderNumber, vendor, items, total })
        }
      };

      logger.info('Successfully parsed email:', {
        messageId: parsedEmail.messageId,
        orderNumber: parsedEmail.parsedData.orderNumber,
        itemCount: parsedEmail.parsedData.items.length
      });

      return parsedEmail;

    } catch (error) {
      logger.error('Error parsing email:', error);
      throw error;
    }
  }

  private getEmailBody(payload: any): string {
    if (!payload) return '';

    // Handle multipart messages
    if (payload.mimeType?.includes('multipart') && payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString();
        }
      }
    }

    // Handle single part messages
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString();
    }

    return '';
  }

  private extractOrderNumber(subject: string, body: string): string | undefined {
    // Updated patterns to better match order numbers
    const patterns = [
      /#\s*(\d+)/i,                         // Matches: Order #12345
    ];

    logger.debug('Extracting order number from subject:', subject);

    // Check subject first
    for (const pattern of patterns) {
      const match = subject.match(pattern);
      if (match) {
        logger.debug('Found order number in subject:', match[1]);
        return match[1];
      }
    }

    logger.debug('Checking body for order number');
    // Then check body
    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) {
        logger.debug('Found order number in body:', match[1]);
        return match[1];
      }
    }

    logger.debug('No order number found');
    return undefined;
  }

  private extractItems(body: string): Array<{
    sku?: string;
    description?: string;
    quantity?: number;
    price?: number;
  }> {
    const items = [];
    const lines = body.split('\n');
    
    const quantityPatterns = [
      /(\d+)\s*x/i,
      /qty:?\s*(\d+)/i,
      /quantity:?\s*(\d+)/i
    ];

    const pricePatterns = [
      /\$\s*(\d+\.?\d*)/,
      /price:?\s*\$?\s*(\d+\.?\d*)/i,
      /(\d+\.?\d*)\s*(?:USD|dollars)/i
    ];

    let inItemsSection = false;

    for (const line of lines) {
      // Check if we're in the items section
      if (line.toLowerCase().includes('items:') || 
          line.toLowerCase().includes('products:') || 
          line.toLowerCase().includes('order details:')) {
        inItemsSection = true;
        continue;
      }

      if (inItemsSection && line.trim()) {
        let quantity, price;

        // Look for quantity
        for (const pattern of quantityPatterns) {
          const match = line.match(pattern);
          if (match) {
            quantity = parseInt(match[1]);
            break;
          }
        }

        // Look for price
        for (const pattern of pricePatterns) {
          const match = line.match(pattern);
          if (match) {
            price = parseFloat(match[1]);
            break;
          }
        }

        // If we found either quantity or price, this might be an item line
        if (quantity || price) {
          items.push({
            description: line.trim(),
            quantity,
            price
          });
        }
      }
    }

    return items;
  }

  private extractTotal(body: string): number | undefined {
    const patterns = [
      /total:?\s*\$?\s*(\d+\.?\d*)/i,
      /amount:?\s*\$?\s*(\d+\.?\d*)/i,
      /\btotal\b.*?\$\s*(\d+\.?\d*)/i
    ];

    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) {
        return parseFloat(match[1]);
      }
    }

    return undefined;
  }

  private calculateConfidence(data: any): {
    orderNumber: number;
    vendor: number;
    items: number;
    overall: number;
  } {
    let confidence = {
      orderNumber: 0,
      vendor: 0,
      items: 0,
      overall: 0
    };

    // Order number confidence
    if (data.orderNumber) {
      confidence.orderNumber = data.orderNumber.length >= 5 ? 0.8 : 0.4;
    }

    // Vendor confidence
    if (data.vendor) {
      confidence.vendor = this.whitelist.senders.includes(data.vendor) ? 0.9 : 0.5;
    }

    // Items confidence
    if (data.items && data.items.length > 0) {
      const itemsWithComplete = data.items.filter((i: any) => 
        i.quantity && i.price && i.description
      ).length;
      confidence.items = itemsWithComplete / data.items.length;
    }

    // Overall confidence
    confidence.overall = (confidence.orderNumber + confidence.vendor + confidence.items) / 3;

    return confidence;
  }

  private getHeader(headers: any[], name: string): string {
    return headers.find((h: any) => h.name === name)?.value || '';
  }

  private extractVendor(from: string, body: string, isForwarded: boolean): string | undefined {
    if (isForwarded) {
      return this.extractOriginalSender(body);
    }

    const emailMatch = from.match(/<(.+?)>/);
    return emailMatch ? emailMatch[1] : from;
  }

  private extractOriginalSender(body: string): string | undefined {
    const patterns = [
      /From:\s*([^\n<]+)?(?:<(.+?)>)?/i,
      /Sender:\s*([^\n<]+)?(?:<(.+?)>)?/i
    ];

    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) {
        return match[2] || match[1]; // Prefer email in brackets if available
      }
    }

    return undefined;
  }
}