import { PubSub } from '@google-cloud/pubsub';
import * as path from 'path';

const CREDENTIALS_PATH = path.join(process.cwd(), 'client_secret.json');

export const pubsubClient = new PubSub({
  keyFilename: CREDENTIALS_PATH
});

export async function setupPubSub() {
  const topicName = 'email-notifications';
  const subscriptionName = 'email-test-sub';

  try {
    // Create topic if it doesn't exist
    let topic;
    try {
      [topic] = await pubsubClient.createTopic(topicName);
      console.log(`Topic ${topicName} created.`);
    } catch (error) {
      if (error.code === 6) { // ALREADY_EXISTS
        topic = pubsubClient.topic(topicName);
        console.log(`Topic ${topicName} already exists.`);
      } else {
        throw error;
      }
    }

    // Create subscription if it doesn't exist
    try {
      await topic.createSubscription(subscriptionName);
      console.log(`Subscription ${subscriptionName} created.`);
    } catch (error) {
      if (error.code === 6) { // ALREADY_EXISTS
        console.log(`Subscription ${subscriptionName} already exists.`);
      } else {
        throw error;
      }
    }

    return { topic, subscription: topic.subscription(subscriptionName) };
  } catch (error) {
    console.error('Error setting up Pub/Sub:', error);
    throw error;
  }
}