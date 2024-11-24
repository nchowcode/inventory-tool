// import { gmailService } from '../config/gmail';
// import { pubsubService } from '../config/pubsub';
// import { logger } from '../utils/logger';

// // Define message type for type safety
// interface PubSubMessage {
//   id: string;
//   data: Buffer;
//   ack(): void;
//   nack(): void;
// }

// async function verifySetup() {
//   try {
//     logger.info('Starting setup verification...');

//     // Test Gmail connection
//     logger.info('Testing Gmail connection...');
//     const labels = await gmailService.listLabels();
//     logger.info('Gmail connection successful', {
//       labelCount: labels?.length || 0
//     });

//     // Test PubSub setup
//     logger.info('Testing PubSub setup...');
//     const { topic, subscription } = await pubsubService.setup();

//     // Test message publishing and receiving
//     logger.info('Testing PubSub message flow...');

//     // Create a promise that resolves when we receive the message
//     const messageReceived = new Promise<void>((resolve) => {
//       pubsubService.listenForMessages(async (data) => {
//         logger.info('Received test message:', data);
//         resolve();
//       });
//     });

//     // Publish a test message
//     const testMessage = {
//       type: 'TEST_MESSAGE',
//       timestamp: new Date().toISOString(),
//       data: {
//         test: true,
//         message: 'Setup verification test'
//       }
//     };

//     const messageId = await pubsubService.publishMessage(testMessage);
//     logger.info('Published test message:', messageId);

//     // Wait for message to be received (with timeout)
//     const timeout = new Promise((_, reject) => {
//       setTimeout(() => reject(new Error('Message receive timeout')), 10000);
//     });

//     await Promise.race([messageReceived, timeout]);

//     logger.info('Setup verification completed successfully');
//     return true;

//   } catch (error) {
//     if (error instanceof Error) {
//       logger.error('Setup verification failed:', error.message);
//       if ('code' in error) {
//         logger.error('Error code:', (error as any).code);
//       }
//     } else {
//       logger.error('Unknown error during verification');
//     }
//     throw error;
//   }
// }

// // Run verification
// if (require.main === module) {
//   verifySetup()
//     .then(() => {
//       logger.info('All verifications passed!');
//       process.exit(0);
//     })
//     .catch((error) => {
//       logger.error('Verification failed:',
//         error instanceof Error ? error.message : 'Unknown error'
//       );
//       process.exit(1);
//     });
// }

// export { verifySetup };
