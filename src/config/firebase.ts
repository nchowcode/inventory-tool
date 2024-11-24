import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';

interface OrderDetails {
  orderNumber: string;
  vendor: string;
  total: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  orderDate: string;
}

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

  async storeEmail(emailData: any, userId: string) {
    try {
      const docRef = await this.db.collection('emails').add({
        ...emailData,
        userId,
        timestamp: new Date(),
        processed: false
      });
      
      logger.info(`Email stored with ID: ${docRef.id} for user: ${userId}`);
      return docRef.id;
    } catch (error) {
      logger.error('Failed to store email:', error);
      throw error;
    }
  }

  async storeOrders(orders: OrderDetails[], userId: string) {
    const batch = this.db.batch();

    try {
      // Get reference to user's orders collection
      const userOrdersRef = this.db.collection('users').doc(userId).collection('orders');
      
      for (const order of orders) {
        // Use order number as document ID for easy lookup
        const orderRef = userOrdersRef.doc(order.orderNumber);
        
        // Add the order with additional metadata
        batch.set(orderRef, {
          ...order,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        }, { merge: true });

        // Also update the inventory collection
        for (const item of order.items) {
          const inventoryRef = this.db
            .collection('users')
            .doc(userId)
            .collection('inventory')
            .doc(this.createInventoryId(item.name));

          // Get current inventory
          const inventoryDoc = await inventoryRef.get();
          const currentQuantity = inventoryDoc.exists ? 
            (inventoryDoc.data()?.quantity || 0) : 0;

          batch.set(inventoryRef, {
            name: item.name,
            quantity: currentQuantity + item.quantity,
            lastOrderPrice: item.price,
            lastUpdated: new Date(),
            orderReferences: firestore.FieldValue.arrayUnion(order.orderNumber)
          }, { merge: true });
        }
      }

      await batch.commit();
      logger.info(`Stored ${orders.length} orders for user: ${userId}`);
      
      return true;
    } catch (error) {
      logger.error('Failed to store orders:', error);
      throw error;
    }
  }

  async markEmailProcessed(emailId: string) {
    try {
      await this.db.collection('emails').doc(emailId).update({
        processed: true,
        processedAt: new Date()
      });
      
      logger.info(`Marked email ${emailId} as processed`);
    } catch (error) {
      logger.error('Failed to mark email as processed:', error);
      throw error;
    }
  }

  async getProcessingQueue(userId: string) {
    try {
      const snapshot = await this.db
        .collection('emails')
        .where('userId', '==', userId)
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

  private createInventoryId(name: string): string {
    // Create a consistent ID from the item name
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async getUserOrders(userId: string, limit = 50) {
    try {
      const snapshot = await this.db
        .collection('users')
        .doc(userId)
        .collection('orders')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.error('Failed to get user orders:', error);
      throw error;
    }
  }

  async getUserInventory(userId: string) {
    try {
      const snapshot = await this.db
        .collection('users')
        .doc(userId)
        .collection('inventory')
        .orderBy('lastUpdated', 'desc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.error('Failed to get user inventory:', error);
      throw error;
    }
  }
}