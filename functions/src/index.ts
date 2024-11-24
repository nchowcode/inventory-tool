// src/index.ts
import { EmailProcessingService } from "./services/email-processor";
import { AuthService } from "./auth/auth-service";
import { logger } from "./utils/logger";
import { initFirebase } from "./config/firebase";

// Initialize Firebase once at startup
initFirebase();

interface ProcessingResult {
  processedCount: number;
  successfulOrders: number;
  failedOrders: number;
  errors: string[];
}

/**
 * Main function to process emails and return results
 */
async function processEmails(): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    processedCount: 0,
    successfulOrders: 0,
    failedOrders: 0,
    errors: [],
  };

  try {
    logger.info("Starting email processing service...");

    // Initialize auth first
    const auth = new AuthService();
    await auth.ensureAuthenticated();
    logger.info("Gmail authentication successful");

    // Initialize email processor
    const processor = new EmailProcessingService();
    await processor.initialize();
    logger.info("Email processor initialized");

    // Process emails
    const results = await processor.processEmails();

    // Compile results
    result.processedCount = results.length;
    result.successfulOrders = results.filter((r) => r.success).length;
    result.failedOrders = results.filter((r) => !r.success).length;
    result.errors = results
      .filter((r) => r.error)
      .map((r) => `Message ${r.messageId}: ${r.error}`);

    // Log detailed results
    logger.info("Email processing completed", {
      total: result.processedCount,
      successful: result.successfulOrders,
      failed: result.failedOrders,
    });

    if (result.errors.length > 0) {
      logger.warn("Errors encountered:", result.errors);
    }

    // Return the final results
    return result;
  } catch (error) {
    const err = error as Error;
    logger.error("Fatal error during processing:", err.message);
    result.errors.push(`Fatal error: ${err.message}`);
    throw error;
  }
}

/**
 * Cloud Function handler
 */
export const processOrderEmails = async (context: any) => {
  try {
    const result = await processEmails();
    return {
      success: true,
      ...result,
    };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      error: err.message,
    };
  }
};

/**
 * Cloud Function scheduled task
 */
export const processOrderEmailsScheduled = async (context: any) => {
  try {
    const result = await processEmails();
    return {
      success: true,
      ...result,
    };
  } catch (error) {
    const err = error as Error;
    logger.error("Scheduled task failed:", err.message);
    return {
      success: false,
      error: err.message,
    };
  }
};

/**
 * Local development entry point
 */
if (require.main === module) {
  logger.info("Running email processor locally");

  processEmails()
    .then((result) => {
      logger.info("Processing completed successfully:", result);
      const exitCode = result.failedOrders === 0 ? 0 : 1;
      process.exit(exitCode);
    })
    .catch((error) => {
      logger.error("Processing failed:", error);
      process.exit(1);
    });
}

// Export for use in other files
export { processEmails };

// Types for external use
export type { ProcessingResult };
