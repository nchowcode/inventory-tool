// src/auth/auth-service.ts
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import { exec } from "child_process";
import { logger } from "../utils/logger";

export class AuthService {
  private oauth2Client: OAuth2Client;
  private readonly CREDENTIALS_PATH: string;
  private readonly TOKEN_PATH: string;

  constructor() {
    this.CREDENTIALS_PATH = path.resolve(
      process.cwd(),
      "src",
      "credentials",
      "client_secret.json"
    );
    this.TOKEN_PATH = path.resolve(
      process.cwd(),
      "src",
      "credentials",
      "token.json"
    );

    logger.info("Loading credentials from:", this.CREDENTIALS_PATH);

    if (!fs.existsSync(this.CREDENTIALS_PATH)) {
      logger.error(
        "Credentials directory contents:",
        fs.existsSync(path.dirname(this.CREDENTIALS_PATH))
          ? fs.readdirSync(path.dirname(this.CREDENTIALS_PATH))
          : "Directory does not exist"
      );
      throw new Error(
        `client_secret.json not found at: ${this.CREDENTIALS_PATH}`
      );
    }

    const credentials = require(this.CREDENTIALS_PATH);

    this.oauth2Client = new google.auth.OAuth2(
      credentials.installed.client_id,
      credentials.installed.client_secret,
      "http://localhost:3000/oauth2callback"
    );
  }

  async ensureAuthenticated(forceNew: boolean = false): Promise<void> {
    try {
      if (forceNew && fs.existsSync(this.TOKEN_PATH)) {
        logger.info("Removing existing token to force new authentication...");
        fs.unlinkSync(this.TOKEN_PATH);
      }

      // Check if we have valid credentials
      if (!fs.existsSync(this.TOKEN_PATH)) {
        logger.info("No token found. Starting authentication flow...");
        await this.authenticate();
        return;
      }

      // Load and verify existing token
      try {
        const token = require(this.TOKEN_PATH);
        this.oauth2Client.setCredentials(token);

        // Test the token
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

              // Save token
              fs.writeFileSync(
                this.TOKEN_PATH,
                JSON.stringify(tokens, null, 2)
              );
              logger.info("Authentication successful! Token saved.");

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

      // Add error handler for the server
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
      logger.info("Auth URL:", authUrl); // In case automatic browser opening fails
      this.openBrowser(authUrl);
    });
  }

  private openBrowser(url: string) {
    try {
      switch (process.platform) {
        case "darwin":
          exec(`open "${url}"`);
          break;
        case "win32":
          exec(`start "${url}"`);
          break;
        default:
          exec(`xdg-open "${url}"`);
      }
    } catch (error) {
      logger.error(
        "Failed to open browser automatically. Please open this URL manually:",
        url
      );
    }
  }

  getAuthClient(): OAuth2Client {
    return this.oauth2Client;
  }
}
