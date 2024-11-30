// src/services/database-service.ts
import { initializeApp, cert } from "firebase-admin/app";
import {
  getFirestore,
  FieldValue,
  Firestore as adminFirestore,
} from "firebase-admin/firestore";
import { logger } from "../utils/logger.js";
import { getAdminDb } from "../config/firebase.js";
import { getAuth } from "firebase-admin/auth";
import { getApp } from "firebase-admin/app";

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
  private db: adminFirestore;

  constructor() {
    try {
      this.db = getAdminDb();
    } catch (error) {
      logger.error("Failed to initialize database service:", error);
      throw error;
    }
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
    console.log("here1");
    try {
      console.log("Current Firebase App:", getApp().options);

      const userRecord = await getAuth().getUser(userId);
      console.log("reason");
      const userEmail = userRecord.email;
      console.log(userEmail);
      const userOrdersRef = this.db
        .collection("users")
        .doc(userId)
        .collection("orders");
      let firstOrderId = "";
      console.log("here2");
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
        console.log("here3");
        console.log("Debug - userId:", userId);
        console.log("Debug - order:", order);
        // console.log("Debug - this.db:", this.db);
        if (!firstOrderId) firstOrderId = order.orderNumber;

        // error occurs here.
        // Update inventory
        getAuth()
          .getUserByEmail(userEmail!)
          .then((userRecord) => {
            // See the UserRecord reference doc for the contents of userRecord.
            console.log(
              `Successfully fetched user data: ${userRecord.toJSON()}`
            );
          })
          .catch((error) => {
            console.log("Error fetching user data:", error);
          });
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
      console.log("here4");
      await batch.commit();
      console.log("here5");
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
