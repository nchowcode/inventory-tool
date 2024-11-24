// src/services/database-service.ts
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Firestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "../utils/logger";

interface EmailData {
  messageId: string;
  from: string;
  subject: string;
  body: string;
  userId: string;
  processed: boolean;
  createdAt: Date;
  processedAt?: Date;
  parsedOrderId?: string;
  error?: string;
}

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

export class DatabaseService {
  private db: Firestore;

  constructor() {
    try {
      this.db = getFirestore();
      logger.info("Firestore database service initialized");
    } catch (error) {
      logger.error("Failed to initialize database service:", error);
      throw error;
    }
  }

  getFirestore(): Firestore {
    return this.db;
  }

  async isMessageProcessed(
    messageId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const snapshot = await this.db
        .collection("emails")
        .where("messageId", "==", messageId)
        .where("userId", "==", userId)
        .where("processed", "==", true)
        .limit(1)
        .get();

      return !snapshot.empty;
    } catch (error) {
      const err = error as Error;
      logger.error("Failed to check message status:", err.message);
      throw error;
    }
  }

  async storeEmail(
    emailData: Partial<EmailData>,
    userId: string
  ): Promise<string> {
    try {
      // Check if email already exists
      if (emailData.messageId) {
        const existingEmail = await this.db
          .collection("emails")
          .where("messageId", "==", emailData.messageId)
          .where("userId", "==", userId)
          .limit(1)
          .get();

        if (!existingEmail.empty) {
          logger.info(
            `Email ${emailData.messageId} already exists for user ${userId}`
          );
          return existingEmail.docs[0].id;
        }
      }

      // Store new email
      const docRef = await this.db.collection("emails").add({
        ...emailData,
        userId,
        processed: false,
        createdAt: new Date(),
      });

      logger.info(`Email stored with ID: ${docRef.id} for user: ${userId}`);
      return docRef.id;
    } catch (error) {
      const err = error as Error;
      logger.error("Failed to store email:", err.message);
      throw error;
    }
  }

  async markEmailProcessed(emailId: string, orderId?: string, error?: string) {
    try {
      await this.db
        .collection("emails")
        .doc(emailId)
        .update({
          processed: true,
          processedAt: new Date(),
          ...(orderId && { parsedOrderId: orderId }),
          ...(error && { error }),
        });

      logger.info(
        `Marked email ${emailId} as processed${
          orderId ? ` with order ${orderId}` : ""
        }`
      );
    } catch (error) {
      const err = error as Error;
      logger.error("Failed to mark email as processed:", err.message);
      throw error;
    }
  }

  async storeOrders(orders: OrderDetails[], userId: string): Promise<string> {
    const batch = this.db.batch();

    try {
      const userOrdersRef = this.db
        .collection("users")
        .doc(userId)
        .collection("orders");
      let firstOrderId = "";

      for (const order of orders) {
        const orderRef = userOrdersRef.doc(order.orderNumber);
        batch.set(
          orderRef,
          {
            ...order,
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          { merge: true }
        );

        if (!firstOrderId) firstOrderId = order.orderNumber;

        // Update inventory
        for (const item of order.items) {
          const inventoryRef = this.db
            .collection("users")
            .doc(userId)
            .collection("inventory")
            .doc(this.createInventoryId(item.name));

          const inventoryDoc = await inventoryRef.get();
          const currentQuantity = inventoryDoc.exists
            ? inventoryDoc.data()?.quantity || 0
            : 0;

          batch.set(
            inventoryRef,
            {
              name: item.name,
              quantity: currentQuantity + item.quantity,
              lastOrderPrice: item.price,
              lastUpdated: new Date(),
              orderReferences: FieldValue.arrayUnion(order.orderNumber),
            },
            { merge: true }
          );
        }
      }

      await batch.commit();
      logger.info(`Stored ${orders.length} orders for user: ${userId}`);

      return firstOrderId;
    } catch (error) {
      const err = error as Error;
      logger.error("Failed to store orders:", err.message);
      throw error;
    }
  }

  private createInventoryId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }
}
