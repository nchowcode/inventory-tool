import { logger } from "../utils/logger.js";
import { EmailProcessingService } from "../services/email-processor.js";

async function testEmailSearch() {
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

// Run the test
testEmailSearch();
