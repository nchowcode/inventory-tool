import { PubSub, Topic, Subscription } from '@google-cloud/pubsub';
import * as path from 'path';
import { logger } from '../utils/logger';

// Custom error class for PubSub errors
class PubSubError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'PubSubError';
  }
}

// Configuration interface
interface PubSubConfig {
  topicName: string;
  subscriptionName: string;
  credentials: string;
}

const DEFAULT_CONFIG: PubSubConfig = {
  topicName: 'email-notifications',
  subscriptionName: 'email-test-sub',
  credentials: path.join(process.cwd(), 'client_secret.json')
};

export class PubSubService {
  private pubsub: PubSub;
  private config: PubSubConfig;

  constructor(config: Partial<PubSubConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.pubsub = new PubSub({
      keyFilename: this.config.credentials
    });
  }

  async setup(): Promise<{ topic: Topic; subscription: Subscription }> {
    try {
      logger.info('Setting up PubSub...');
      const topic = await this.getOrCreateTopic();
      const subscription = await this.getOrCreateSubscription(topic);
      
      logger.info('PubSub setup completed successfully');
      return { topic, subscription };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to setup PubSub:', errorMessage);
      throw new PubSubError('PubSub setup failed', 
        (error as any)?.code, 
        error
      );
    }
  }

  private async getOrCreateTopic(): Promise<Topic> {
    try {
      const topic = this.pubsub.topic(this.config.topicName);
      const [exists] = await topic.exists();
      
      if (!exists) {
        logger.info(`Creating topic: ${this.config.topicName}`);
        const [newTopic] = await this.pubsub.createTopic(this.config.topicName);
        logger.info(`Topic created successfully`);
        return newTopic;
      }

      logger.info(`Using existing topic: ${this.config.topicName}`);
      return topic;
    } catch (error) {
      if ((error as any)?.code === 6) {
        logger.info(`Topic ${this.config.topicName} already exists`);
        return this.pubsub.topic(this.config.topicName);
      }
      throw error;
    }
  }

  private async getOrCreateSubscription(topic: Topic): Promise<Subscription> {
    try {
      const subscription = topic.subscription(this.config.subscriptionName);
      const [exists] = await subscription.exists();
      
      if (!exists) {
        logger.info(`Creating subscription: ${this.config.subscriptionName}`);
        const [newSubscription] = await topic.createSubscription(
          this.config.subscriptionName
        );
        logger.info(`Subscription created successfully`);
        return newSubscription;
      }

      logger.info(`Using existing subscription: ${this.config.subscriptionName}`);
      return subscription;
    } catch (error) {
      if ((error as any)?.code === 6) {
        logger.info(`Subscription ${this.config.subscriptionName} already exists`);
        return topic.subscription(this.config.subscriptionName);
      }
      throw error;
    }
  }

  async publishMessage(data: any): Promise<string> {
    try {
      const dataBuffer = Buffer.from(JSON.stringify(data));
      const messageId = await this.pubsub
        .topic(this.config.topicName)
        .publish(dataBuffer);
      
      logger.info(`Message published successfully. ID: ${messageId}`);
      return messageId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to publish message:', errorMessage);
      throw new PubSubError('Failed to publish message', 
        (error as any)?.code, 
        error
      );
    }
  }

  async listenForMessages(
    handleMessage: (message: any) => Promise<void>
  ): Promise<void> {
    const subscription = this.pubsub
      .subscription(this.config.subscriptionName);

    subscription.on('message', async (message) => {
      try {
        logger.info('Received message:', message.id);
        await handleMessage(JSON.parse(message.data.toString()));
        message.ack();
        logger.info('Message processed successfully:', message.id);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Error processing message:', errorMessage);
        message.nack();
      }
    });

    subscription.on('error', (error) => {
      logger.error('Subscription error:', error);
    });

    logger.info('Started listening for messages');
  }
}

// Export a default instance
export const pubsubService = new PubSubService();