// src/auth/auth-service.ts
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as http from "http";
import { logger } from "../utils/logger.js";
import { clientSecret } from "../credentials/clientSecret.js";
import { token } from "../credentials/token.js";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

export class AuthService {
  private oauth2Client: OAuth2Client;
  private readonly credentials: typeof clientSecret;
  private readonly existingToken: typeof token;
  private userId: string;

  constructor() {
    // Store the imported values directly
    this.credentials = clientSecret;
    this.existingToken = token;
    logger.info("Initializing auth service with credentials");
    this.userId = "";
    // Create OAuth2 client using the imported credentials
    this.oauth2Client = new google.auth.OAuth2(
      this.credentials.installed.client_id,
      this.credentials.installed.client_secret,
      "http://localhost:3000/oauth2callback"
    );
  }

  public getAuthClient(): OAuth2Client {
    if (!this.oauth2Client) {
      throw new Error(
        "OAuth2Client not initialized. Make sure to call ensureAuthenticated first."
      );
    }
    return this.oauth2Client;
  }

  async ensureAuthenticated(forceNew: boolean = false): Promise<void> {
    try {
      if (forceNew) {
        logger.info("Forcing new authentication...");
        await this.authenticate();
        return;
      }

      // Check if we have a valid token in memory
      if (!this.existingToken) {
        logger.info("No token found. Starting authentication flow...");
        await this.authenticate();
        return;
      }

      // Verify existing token
      try {
        this.oauth2Client.setCredentials(this.existingToken);
        const gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
        await gmail.users.labels.list({ userId: "me" });
        logger.info("Existing token is valid");
      } catch (error) {
        logger.info(
          "Token invalid or expired. Starting authentication flow..."
        );
        await this.authenticate();
      }
    } catch (error) {
      logger.error("Authentication failed:", error);
      throw error;
    }
  }

  private async getGmailUserInfo(): Promise<string> {
    try {
      const gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
      const profile = await gmail.users.getProfile({ userId: "me" });
      return profile.data.emailAddress || "";
    } catch (error) {
      logger.error("Failed to get Gmail user info:", error);
      throw error;
    }
  }

  private async handleGmailAuth(gmailUserEmail: string): Promise<string> {
    try {
      let userRecord;
      try {
        // Try to find existing user
        userRecord = await getAuth().getUserByEmail(gmailUserEmail);
        logger.info(`Found existing user for email: ${gmailUserEmail}`);
      } catch (error) {
        // Create new user if doesn't exist
        logger.info(`Creating new user for email: ${gmailUserEmail}`);
        userRecord = await getAuth().createUser({
          email: gmailUserEmail,
          emailVerified: true,
        });

        // Initialize user data in Firestore
        await getFirestore().collection("users").doc(userRecord.uid).set({
          email: gmailUserEmail,
          createdAt: new Date(),
          lastLogin: new Date(),
          gmailConnected: true,
        });
      }

      return userRecord.uid;
    } catch (error) {
      logger.error("Error handling Gmail auth:", error);
      throw error;
    }
  }

  private async authenticate(): Promise<void> {
    return new Promise((resolve, reject) => {
      let server: http.Server;

      const cleanup = () => {
        try {
          if (server) {
            server.close();
          }
        } catch (error) {
          logger.error("Error closing server:", error);
        }
      };

      server = http
        .createServer(async (req, res) => {
          try {
            const url = new URL(req.url!, `http://${req.headers.host}`);
            const code = url.searchParams.get("code");

            if (code) {
              const { tokens } = await this.oauth2Client.getToken(code);
              this.oauth2Client.setCredentials(tokens);

              // Instead of saving to file, you might want to handle the new token
              // through a callback or event system
              logger.info("Authentication successful! Token received.");
              const gmailEmail = await this.getGmailUserInfo();
              this.userId = await this.handleGmailAuth(gmailEmail);

              logger.info(`Authentication successful for user: ${this.userId}`);

              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(
                "<h1>Authentication successful!</h1><p>You can close this window.</p>"
              );

              cleanup();
              resolve();
            }
          } catch (error) {
            cleanup();
            reject(error);
          }
        })
        .listen(3000);

      server.on("error", (error) => {
        logger.error("Server error:", error);
        cleanup();
        reject(error);
      });

      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: [
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/gmail.modify",
          "https://www.googleapis.com/auth/gmail.labels",
        ],
        prompt: "consent",
      });

      logger.info("Opening browser for authentication...");
      logger.info("Auth URL:", authUrl);
      this.openBrowser(authUrl);
    });
  }
  private openBrowser(url: string) {
    // Import the 'open' package we have in our dependencies
    import("open")
      .then((openModule) => {
        const open = openModule.default;
        try {
          // Use the 'open' package to handle cross-platform URL opening
          open(url).catch((error) => {
            // If automatic opening fails, we fall back to manual instructions
            logger.error(
              "Failed to open browser automatically. Please open this URL manually:",
              url
            );
          });
        } catch (error) {
          // If there's any error in the process, log it and show the URL
          logger.error(
            "Failed to open browser automatically. Please open this URL manually:",
            url
          );
        }
      })
      .catch((error) => {
        // If importing the 'open' package fails, log the error and show the URL
        logger.error(
          "Failed to load browser opening utility. Please open this URL manually:",
          url
        );
      });
  }

  public getUserId() {
    return this.userId;
  }
}
