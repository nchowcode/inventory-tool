import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';

export class Database {
  private db: Firestore;

  constructor() {
    try {
      // Initialize with admin privileges
      initializeApp({
        credential: cert('./service-account.json')
      });

      this.db = getFirestore();
      logger.info('Firestore initialized with admin privileges');
    } catch (error) {
      logger.error('Failed to initialize Firestore:', error);
      throw error;
    }
  }

  async storeEmail(emailData: any) {
    try {
      const docRef = await this.db.collection('emails').add({
        ...emailData,
        timestamp: new Date(),
        processed: false
      });
      
      logger.info('Email stored with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      logger.error('Failed to store email:', error);
      throw error;
    }
  }

  async updateInventory(items: any[]) {
    const batch = this.db.batch();

    try {
      for (const item of items) {
        const itemRef = this.db.collection('inventory').doc(item.sku);
        batch.set(itemRef, {
          ...item,
          lastUpdated: new Date()
        }, { merge: true });
      }

      await batch.commit();
      logger.info(`Updated ${items.length} inventory items`);
    } catch (error) {
      logger.error('Failed to update inventory:', error);
      throw error;
    }
  }

  async getProcessingQueue() {
    try {
      const snapshot = await this.db
        .collection('emails')
        .where('processed', '==', false)
        .orderBy('timestamp')
        .limit(10)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.error('Failed to get processing queue:', error);
      throw error;
    }
  }
}