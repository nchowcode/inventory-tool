import { logger } from '../utils/logger';

interface OrderDetails {
  orderNumber: string;
  vendor: string;
  total: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  orderDate: string;
}

interface VendorPattern {
  name: string;
  domains: string[];
  patterns: {
    orderNumber: RegExp[];
    total: RegExp[];
    item: RegExp[];
    quantity: RegExp[];
    price: RegExp[];
  };
}

export class SmartParser {
  private readonly vendorPatterns: VendorPattern[] = [
    {
      name: 'Amazon',
      domains: ['amazon.com'],
      patterns: {
        orderNumber: [
          /Order #\s*(\d{3}-\d{7}-\d{7})/i,
        ],
        total: [
          /Order Total:\s*\$\s*([\d,]+\.\d{2})/i,
        ],
        item: [
            /Your Amazon\.com order of (\d+) x "([^"]+)"/i,  // Match quantity and item
          ],
        quantity: [
          /Quantity:\s*(\d+)/i,
        ],
        price: [
          /\$\s*([\d,]+\.\d{2})/,
        ]
      }
    },
    {
      name: 'Nike',
      domains: ['nike.com'],
      patterns: {
        orderNumber: [
          /Order Number:?\s*([A-Z0-9-]+)/i,
          /Confirmation Number:?\s*([A-Z0-9-]+)/i,
        ],
        total: [
          /Total:\s*\$\s*([\d,]+\.\d{2})/i,
          /Amount:\s*\$\s*([\d,]+\.\d{2})/i,
        ],
        item: [
          /Style:\s*(.*?)(?=Size:|$)/s,
        ],
        quantity: [
          /Quantity:\s*(\d+)/i,
          /QTY:\s*(\d+)/i,
        ],
        price: [
          /Price:\s*\$\s*([\d,]+\.\d{2})/i,
          /\$\s*([\d,]+\.\d{2})/,
        ]
      }
    }
  ];

  // Common patterns that work across vendors
  private readonly commonPatterns = {
    orderNumber: [
      /#\s*([A-Z0-9-]{5,})/i,
      /order[:\s#]+([A-Z0-9-]{5,})/i,
      /confirmation[:\s#]+([A-Z0-9-]{5,})/i,
    ],
    total: [
      /total:?\s*\$\s*([\d,]+\.\d{2})/i,
      /amount:?\s*\$\s*([\d,]+\.\d{2})/i,
      /\btotal\b.*?\$\s*([\d,]+\.\d{2})/i,
    ],
    price: [
      /\$\s*([\d,]+\.\d{2})/,
      /price:?\s*\$\s*([\d,]+\.\d{2})/i,
    ],
    quantity: [
      /qty:?\s*(\d+)/i,
      /quantity:?\s*(\d+)/i,
      /×\s*(\d+)/,
    ]
  };

  async parseEmail(from: string, subject: string, body: string): Promise<OrderDetails | null> {
    try {
      // Detect vendor
      const vendor = this.detectVendor(from);
      logger.info(`Detected vendor: ${vendor || 'Unknown'}`);
  
      // Get vendor-specific patterns if available
      const vendorPattern = this.vendorPatterns.find(p => p.name === vendor);
      
      // Extract items based on vendor
      let items = [];
      if (vendor === 'Amazon') {
        items = this.extractAmazonItems(subject, body);
        logger.info('Extracted Amazon items:', items);
      } else {
        items = this.extractItems(body, vendorPattern);
        logger.info('Extracted vendor items:', items);
      }
  
      // Extract order details
      const orderDetails = {
        orderNumber: this.extractOrderNumber(subject, body, vendorPattern),
        vendor: vendor || 'Unknown',
        total: this.extractTotal(body, vendorPattern),
        items: items,  // Use the items we extracted above
        orderDate: new Date().toISOString()
      };
  
      // Debug log the order details
      logger.info('Parsed order details:', orderDetails);
  
      // Validate extracted data
      if (this.validateOrderDetails(orderDetails)) {
        logger.info(`Successfully parsed order ${orderDetails.orderNumber}`);
        return orderDetails;
      } else {
        logger.warn('Order validation failed:', orderDetails);
      }
  
      return null;
    } catch (error) {
      logger.error('Error parsing email:', error);
      return null;
    }
  }

  private detectVendor(from: string): string | null {
    const emailDomain = from.toLowerCase();
    for (const vendor of this.vendorPatterns) {
      if (vendor.domains.some(domain => emailDomain.includes(domain))) {
        return vendor.name;
      }
    }
    return null;
  }

  private extractOrderNumber(subject: string, body: string, vendorPattern?: VendorPattern): string {
    const patterns = [
      ...(vendorPattern?.patterns.orderNumber || []),
      ...this.commonPatterns.orderNumber
    ];

    for (const pattern of patterns) {
      const match = subject.match(pattern) || body.match(pattern);
      if (match) return match[1];
    }

    return 'UNKNOWN';
  }

  private extractTotal(body: string, vendorPattern?: VendorPattern): number {
    const patterns = [
      ...(vendorPattern?.patterns.total || []),
      ...this.commonPatterns.total
    ];

    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) {
        return parseFloat(match[1].replace(/,/g, ''));
      }
    }

    return 0;
  }

  private extractItems(body: string, vendorPattern?: VendorPattern): Array<any> {
    const items: Array<any> = [];
    const lines = body.split('\n');
    
    let currentItem: any = {};
    
    for (const line of lines) {
      // Try to extract price
      const priceMatch = this.findFirstMatch(line, [
        ...(vendorPattern?.patterns.price || []),
        ...this.commonPatterns.price
      ]);

      // Try to extract quantity
      const quantityMatch = this.findFirstMatch(line, [
        ...(vendorPattern?.patterns.quantity || []),
        ...this.commonPatterns.quantity
      ]);

      if (priceMatch || quantityMatch) {
        if (priceMatch) currentItem.price = parseFloat(priceMatch[1].replace(/,/g, ''));
        if (quantityMatch) currentItem.quantity = parseInt(quantityMatch[1]);
        
        // If we have both price and quantity, assume this is an item line
        if (currentItem.price && currentItem.quantity) {
          currentItem.name = line.trim();
          items.push({ ...currentItem });
          currentItem = {};
        }
      }
    }

    return items;
  }

  private findFirstMatch(text: string, patterns: RegExp[]): RegExpMatchArray | null {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match;
    }
    return null;
  }


// only for amazon items which takes from subject line
private extractAmazonItems(subject: string, body: string): Array<any> {
  const items: Array<any> = [];
  
  // Try to extract item information from subject
  for (const pattern of this.vendorPatterns[0].patterns.item) {
    const match = subject.match(pattern);
    if (match) {
      let itemName = '';
      let quantity = 1;

      // Check if it's the pattern with quantity
      if (pattern.toString().includes('\\d+') && match[2]) {
        quantity = parseInt(match[1]);
        itemName = match[2];
      } else {
        itemName = match[1];
      }

      // Look for "2 x" pattern at start of item name
      const qtyMatch = itemName.match(/^(\d+)\s*x\s*"?(.+?)"?$/i);
      if (qtyMatch) {
        quantity = parseInt(qtyMatch[1]);
        itemName = qtyMatch[2];
      }

      // Get the total from the email
      const total = this.extractTotal(body);
      
      // Calculate price per item if we have a total
      const price = total > 0 ? total / quantity : 0;

      items.push({
        name: itemName.trim(),
        quantity: quantity,
        price: Number(price.toFixed(2))  // Round to 2 decimal places
      });

      break; // Stop after first match
    }
  }

  return items;
}
private validateOrderDetails(details: OrderDetails): boolean {
  // Modified validation for Amazon orders which might not have price info
  if (details.vendor === 'Amazon') {
    return !!(
      details.orderNumber &&
      details.orderNumber !== 'UNKNOWN' &&
      details.items.length > 0
    );
  }
  
  // Original validation for other vendors
  return !!(
    details.orderNumber &&
    details.orderNumber !== 'UNKNOWN' &&
    details.total > 0 &&
    details.items.length > 0
  );
}
}