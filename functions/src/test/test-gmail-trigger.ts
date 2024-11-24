import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { PubSub } from '@google-cloud/pubsub';

async function testGmailTrigger() {
  const pubsub = new PubSub();
  const topicName = 'email-notifications';

  // Set up OAuth2 client (you'll need to set these up in Google Cloud Console)
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  // Set credentials (you'll need to get these first)
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    // Watch for Gmail changes
    const watchResponse = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: `projects/${process.env.GOOGLE_PROJECT_ID}/topics/${topicName}`,
        labelIds: ['INBOX']
      }
    });

    console.log('Watch response:', watchResponse.data);

  } catch (error) {
    console.error('Error setting up Gmail watch:', error);
  }
}

testGmailTrigger().catch(console.error);