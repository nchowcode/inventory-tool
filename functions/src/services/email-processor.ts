// src/services/email-processor.ts
import { GmailService } from "../email/parser";
import { DatabaseService } from "./database-service";
import { SmartParser } from "../parsers/smart-parser";
import { AuthService } from "../auth/auth-service";
import { logger } from "../utils/logger";
import { initFirebase } from "../config/firebase";
import { OAuth2Client } from "google-auth-library";

interface ProcessedEmail {
  success: boolean;
  messageId: string;
  orderId?: string;
  userId?: string;
  error?: string;
}

export class EmailProcessingService {
  private authService: AuthService;
  private gmailService!: GmailService;
  private dbService: DatabaseService;
  private parser: SmartParser;

  constructor() {
    // Initialize Firebase
    initFirebase();
    this.authService = new AuthService();
    this.dbService = new DatabaseService();
    this.parser = new SmartParser();
  }

  // Add method to expose auth client
  getAuthClient(): OAuth2Client {
    return this.authService.getAuthClient();
  }

  async initialize() {
    try {
      await this.authService.ensureAuthenticated(true);
      this.gmailService = new GmailService(this.authService);
      logger.info("Email processing service initialized");
    } catch (error) {
      logger.error("Failed to initialize email processing:", error);
      throw error;
    }
  }

  async processEmails(): Promise<ProcessedEmail[]> {
    try {
      // Use the exact same search query that works in your tests
      const query =
        'from:auto-confirm@amazon.com subject:"Your Amazon.com order of"';
      const emails = await this.gmailService.searchEmails(query);

      logger.info(`Found ${emails.length} emails to process`);

      const results: ProcessedEmail[] = [];

      for (const email of emails) {
        try {
          // Parse using your working SmartParser implementation
          const orderDetails = await this.parser.parseEmail(
            email.from,
            email.subject,
            email.body
          );

          if (orderDetails && orderDetails.orderNumber !== "UNKNOWN") {
            // Store the order details
            const orderId = await this.dbService.storeOrders(
              [orderDetails],
              "userId"
            );

            results.push({
              success: true,
              messageId: email.id,
              orderId: orderDetails.orderNumber,
              userId: "userId",
            });

            logger.info(
              `Successfully processed order ${orderDetails.orderNumber} from email ${email.id}`
            );

            // Log the successful parse
            logger.info("Parsed Order Details:", {
              orderNumber: orderDetails.orderNumber,
              vendor: orderDetails.vendor,
              total: orderDetails.total,
              items: orderDetails.items,
            });
          } else {
            results.push({
              success: false,
              messageId: email.id,
              error: "Failed to parse order details",
            });

            logger.warn(`Failed to parse order details from email ${email.id}`);
          }
        } catch (error) {
          const err = error as Error;
          logger.error(`Failed to process email ${email.id}:`, err.message);
          results.push({
            success: false,
            messageId: email.id,
            error: err.message,
          });
        }
      }

      // Log overall results
      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      logger.info("Processing Summary:", {
        total: results.length,
        successful: successCount,
        failed: failureCount,
      });

      return results;
    } catch (error) {
      const err = error as Error;
      logger.error("Failed to process emails:", err.message);
      throw error;
    }
  }
}

// Main entry point
if (require.main === module) {
  logger.info("Starting email processing service...");

  const processor = new EmailProcessingService();
  processor
    .initialize()
    .then(() => {
      logger.info("Initialized successfully, processing emails...");
      return processor.processEmails();
    })
    .then((results) => {
      logger.info("Processing completed successfully");
      logger.info("Results:", results);
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Processing failed:", error);
      process.exit(1);
    });
}
function getFirestoreInstance() {
  throw new Error("Function not implemented.");
}
