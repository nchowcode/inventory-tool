import { AuthService } from "./auth/auth-service";
import { GmailService } from "./config/gmail";
import { EmailProcessor } from "./services/email-processor";
import { logger } from "./utils/logger";

async function main() {
  try {
    // Initialize services
    const authService = new AuthService();
    await authService.ensureAuthenticated();

    const gmailService = new GmailService(authService);
    const emailProcessor = new EmailProcessor(gmailService);

    const searchQueries = [
      'from:auto-confirm@amazon.com subject: "Your Amazon.com order of"',
    ];
    const query = searchQueries[0];
    logger.info(`Testing search with query: ${query}`);

    // Process emails and get parsed orders
    const parsedOrders = await emailProcessor.processEmails();

    // Log results
    logger.info(`Processed ${parsedOrders.length} orders:`);
    parsedOrders.forEach((order) => {
      console.log("\nOrder:", {
        orderNumber: order.orderNumber,
        vendor: order.vendor,
        items: order.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
      });
    });
  } catch (error) {
    logger.error("Error in main:", error);
  }
}

// Run the program
main();
