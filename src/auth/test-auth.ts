import { AuthService } from './auth-service';
import { google } from 'googleapis';
import { logger } from '../utils/logger';

async function testAuthentication() {
  try {
    logger.info('Starting authentication test...');
    
    const authService = new AuthService();
    
    // Check if we're already authenticated
    const isAuthenticated = await authService.validateAuth();
    
    if (!isAuthenticated) {
      logger.info('No valid token found. Starting authentication flow...');
      await authService.authenticate();
    }

    // Test Gmail API access
    const gmail = google.gmail({ 
      version: 'v1', 
      auth: authService.getAuthClient() 
    });

    logger.info('Testing Gmail API access...');
    const response = await gmail.users.labels.list({ userId: 'me' });
    
    logger.success('Gmail API test successful!');
    logger.info('Found labels:', response.data.labels?.map(label => label.name));

  } catch (error) {
    logger.error('Authentication test failed:', error);
  }
}

// Run the test
testAuthentication();