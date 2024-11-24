export interface WhitelistConfig {
  subjects: string[];
  senders: string[];
  forwarders: string[];
  keywords: string[];
}

export interface ParsedEmail {
  messageId?: string;
  subject: string;
  from: string;
  receivedDate: Date;
  isForwarded: boolean;
  originalSender?: string;
  parsedData: {
    orderNumber?: string;
    vendor?: string;
    items: Array<{
      sku?: string;
      description?: string;
      quantity?: number;
      price?: number;
    }>;
    total?: number;
    confidence: {
      orderNumber: number;
      vendor: number;
      items: number;
      overall: number;
    };
  };
}

// src/types/index.ts
export interface ProcessingResult {
  processedCount: number;
  successfulOrders: number;
  failedOrders: number;
  errors: string[];
}

export interface ProcessedEmail {
  success: boolean;
  messageId: string;
  orderId?: string;
  userId?: string;
  error?: string;
}

export interface OrderDetails {
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
