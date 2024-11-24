import { HttpFunction } from '@google-cloud/functions-framework/build/src/functions';
import { logger } from './utils/logger';
import { EmailParser } from './email/parser';
import { WhitelistConfig } from './email/types';
import { Database } from './config/firebase';

const whitelist: WhitelistConfig = {
  subjects: ['order', 'confirmation', 'invoice'],
  senders: ['nike@official.nike.com', 'sales@supplier.com'], // Add your vendors
  forwarders: ['myemail@gmail.com'], // Add your forwarding email
  keywords: ['order', 'purchase', 'confirmation']
};

const db = new Database();
const parser = new EmailParser();

export const processEmail: HttpFunction = async (req, res) => {
  try {
    // Parse the email
    const parsedEmail = await parser.parseEmail(req.body);

    // Store in Firestore
    const emailId = await db.storeEmail(parsedEmail);

    // If there are inventory items, update them
    if (parsedEmail.parsedData?.items?.length > 0) {
      await db.updateInventory(parsedEmail.parsedData.items);
    }

    logger.info('Successfully processed email:', emailId);
    res.status(200).send({ success: true, emailId });

  } catch (error) {
    logger.error('Failed to process email:', error);
    res.status(500).send({ error: 'Failed to process email' });
  }
};