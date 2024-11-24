import { AuthService } from '../../auth/auth-service';
import { GmailService } from '../../email/parser';
import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

async function testEmailSearch() {
    try {
      // Initialize services
      logger.info('Initializing services...');
      const authService = new AuthService();
      await authService.ensureAuthenticated();
      const gmailService = new GmailService(authService);
        // get by sender
        // auto-confirm@amazon.com
      // Different search queries you can try:
      const searchQueries = [
        'from:auto-confirm@amazon.com subject: "Your Amazon.com order of"',
      ];
      
      // Test the first search query
      const query = searchQueries[0];
      logger.info(`Testing search with query: ${query}`);
  
    //   const emails = await gmailService.searchEmails(query, 3);
        const emails = await gmailService.searchEmails(query, 10)

      // Create output directory
      const outputDir = path.join(process.cwd(), 'email-samples');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
      }
  
      // Process results
      for (const email of emails) {
        // Log basic info
        console.log('\n=== Email Found ===');
        console.log('From:', email.from);
        console.log('Subject:', email.subject);
        console.log('Date:', email.date);
        console.log('Preview:', email.body);
        console.log('=================\n');
  
        // Save full email data
        const fileName = path.join(outputDir, `email-${email.id}.json`);
        fs.writeFileSync(fileName, JSON.stringify(email, null, 2));
        logger.info(`Saved email to ${fileName}`);
      }
  
      logger.info(`Found ${emails.length} emails matching the query`);
  
    } catch (error) {
      logger.error('Search test failed:', error);
    }
  }
  
  // Run the test
  testEmailSearch();