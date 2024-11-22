import { HttpFunction } from '@google-cloud/functions-framework/build/src/functions';
import { logger } from './utils/logger';
import { EmailParser } from './email/parser';
import { WhitelistConfig } from './email/types';

const whitelist: WhitelistConfig = {
  subjects: ['order', 'confirmation', 'invoice'],
  senders: ['nike@official.nike.com', 'sales@supplier.com'], // Add your vendors
  forwarders: ['myemail@gmail.com'], // Add your forwarding email
  keywords: ['order', 'purchase', 'confirmation']
};

const emailParser = new EmailParser(whitelist);

export const processEmail: HttpFunction = async (req, res) => {
  try {
    logger.info('Received webhook request');

    if (!req.body) {
      logger.warn('No request body received');
      return res.status(400).send({ error: 'No request body' });
    }
    const parsedEmail = await emailParser.parseEmail(req.body);
    logger.info('Successfully processed email');

    res.status(200).send({
      success: true,
      data: parsedEmail
    });

  } catch (error) {
    logger.error('Error processing webhook:', error);
    res.status(500).send({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};