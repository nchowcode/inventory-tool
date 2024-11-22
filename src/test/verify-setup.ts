import { getGmailClient } from '../config/gmail';
import { setupPubSub } from '../config/pubsub';

async function verifySetup() {
  try {
    console.log('Testing Gmail connection...');
    const gmail = await getGmailClient();
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log('Successfully connected to Gmail as:', profile.data.emailAddress);

    console.log('\nTesting Pub/Sub setup...');
    const { topic, subscription } = await setupPubSub();
    
    // Test publishing a message
    const testMessage = Buffer.from(JSON.stringify({
      test: true,
      timestamp: new Date().toISOString()
    }));
    
    const messageId = await topic.publish(testMessage);
    console.log('Published test message:', messageId);

    // Listen for the message
    console.log('Listening for test message...');
    subscription.on('message', message => {
      console.log('Received message:', message.id);
      console.log('Data:', message.data.toString());
      message.ack();
      process.exit(0);
    });

    // Set timeout
    setTimeout(() => {
      console.log('No message received after 10s');
      process.exit(1);
    }, 10000);

  } catch (error) {
    console.error('Setup verification failed:', error);
    process.exit(1);
  }
}

verifySetup();