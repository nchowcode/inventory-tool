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