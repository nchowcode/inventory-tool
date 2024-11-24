import { google } from "googleapis";
import { AuthService } from "../auth/auth-service";
import { logger } from "../utils/logger";

interface EmailData {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  body: string;
  rawPayload?: any;
}

export class GmailService {
  private gmail;

  constructor(authService: AuthService) {
    this.gmail = google.gmail({
      version: "v1",
      auth: authService.getAuthClient(),
    });
  }

  async searchEmails(
    query: string,
    maxResults: number = 5
  ): Promise<EmailData[]> {
    try {
      logger.info(`Searching for emails with query: ${query}`);
      logger.info(`Max results: ${maxResults}`);

      // List messages matching the search query
      const listResponse = await this.gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: maxResults,
      });

      if (!listResponse.data.messages) {
        logger.info("No messages found matching the query");
        return [];
      }

      logger.info(`Found ${listResponse.data.messages.length} messages`);

      // Get full details for each message
      const emails: EmailData[] = [];
      for (const message of listResponse.data.messages) {
        try {
          const fullMessage = await this.gmail.users.messages.get({
            userId: "me",
            id: message.id!,
            format: "full",
          });

          const headers = fullMessage.data.payload?.headers || [];

          const email: EmailData = {
            id: fullMessage.data.id!,
            threadId: fullMessage.data.threadId!,
            from: this.getHeader(headers, "From"),
            subject: this.getHeader(headers, "Subject"),
            date: this.getHeader(headers, "Date"),
            body: this.getEmailBody(fullMessage.data.payload),
            rawPayload: fullMessage.data.payload,
          };

          emails.push(email);
          logger.info(`Successfully processed email: ${email.subject}`);
        } catch (error) {
          logger.error(`Error processing message ${message.id}:`, error);
          continue; // Skip this email and continue with others
        }
      }

      logger.info(`Successfully processed ${emails.length} emails`);
      return emails;
    } catch (error) {
      logger.error("Error searching emails:", error);
      throw error;
    }
  }

  private getHeader(headers: any[], name: string): string {
    return headers.find((h) => h.name === name)?.value || "";
  }

  private getEmailBody(payload: any): string {
    if (!payload) return "";

    // Handle multipart messages
    if (payload.mimeType === "multipart/alternative" && payload.parts) {
      // Try to find plain text version first
      const plainText = payload.parts.find(
        (part: any) => part.mimeType === "text/plain"
      );

      if (plainText && plainText.body.data) {
        return Buffer.from(plainText.body.data, "base64").toString();
      }

      // Fall back to HTML version
      const html = payload.parts.find(
        (part: any) => part.mimeType === "text/html"
      );

      if (html && html.body.data) {
        const htmlContent = Buffer.from(html.body.data, "base64").toString();
        // Remove HTML tags for readability
        return htmlContent
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }
    }

    // Handle single part messages
    if (payload.body && payload.body.data) {
      return Buffer.from(payload.body.data, "base64").toString();
    }

    return "";
  }

  // Helper method to parse Gmail's nested multipart messages
  private parseMessagePart(part: any): string {
    if (part.parts) {
      return part.parts
        .map((subPart: any) => this.parseMessagePart(subPart))
        .join("\n");
    }

    if (part.body.data) {
      return Buffer.from(part.body.data, "base64").toString();
    }

    return "";
  }
}
