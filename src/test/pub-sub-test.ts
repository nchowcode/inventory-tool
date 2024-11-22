import { PubSub } from '@google-cloud/pubsub';

async function testPubSub() {
  const pubsub = new PubSub();
  const topicName = 'email-notifications';
  const subscriptionName = 'email-test-sub';

  try {
    // Test publishing
    const testMessage = {
      type: 'TEST_MESSAGE',
      timestamp: new Date().toISOString(),
      data: {
        subject: 'Test Email Subject',
        from: 'test@example.com',
        messageId: 'test-' + Date.now()
      }
    };

    // Publish a message
    const messageId = await pubsub
      .topic(topicName)
      .publish(Buffer.from(JSON.stringify(testMessage)));
    
    console.log('Published test message:', messageId);

    // Listen for messages
    const subscription = pubsub.subscription(subscriptionName);
    
    console.log('Listening for messages...');
    
    subscription.on('message', message => {
      console.log('Received message:', message.id);
      console.log('Data:', message.data.toString());
      message.ack();
    });

    subscription.on('error', error => {
      console.error('Subscription error:', error);
    });

    // Keep script running for a bit
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testPubSub().catch(console.error);