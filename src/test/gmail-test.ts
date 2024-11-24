import { AuthService } from '../auth/auth-service';
import { GmailService } from '../email/parser';
import { logger } from '../utils/logger';

async function testOrderEmails() {
  try {
    // Initialize auth service
    logger.info('Initializing services...');
    const authService = new AuthService();

    // Ensure we're authenticated before proceeding
    logger.info('Checking authentication...');
    await authService.ensureAuthenticated();

    // Initialize Gmail service
    const gmailService = new GmailService(authService);

    // Check for order emails
    logger.info('Checking for order-related emails...');
    const orderEmails = await gmailService.listOrderEmails();

    if (orderEmails.length === 0) {
      logger.info('No order emails found');
      return;
    }

    // Display order email information
    logger.info(`Found ${orderEmails.length} order emails:`);
    for (const email of orderEmails) {
      console.log('\n=== Order Email ===');
      console.log('From:', email.from);
      console.log('Subject:', email.subject);
      console.log('Date:', email.date);
      console.log('Preview:', email.body.substring(0, 150) + '...');
      console.log('==================\n');
    }

  } catch (error) {
    logger.error('Test failed:', error);
  }
}

// Run the test
testOrderEmails();