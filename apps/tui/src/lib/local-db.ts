/**
 * Local SQLite database for storing message history on TUI device
 * Uses Bun's built-in SQLite support for persistent storage
 */

import { Database } from "bun:sqlite";
import { logger } from "./logger";
import fs from "node:fs";

const DB_DIR = `${Bun.env.HOME}/.auxlink/data`;
const DB_PATH = `${DB_DIR}/messages.db`;

export interface LocalMessage {
  id: string; // Server-generated message ID
  conversationId: string; // Device ID of the other party (sender or recipient)
  content: string; // Decrypted message content
  encryptedContent: string; // Encrypted content (for backup/debugging)
  isSent: boolean; // true if sent by this device, false if received
  status: "pending" | "sent" | "delivered" | "read";
  timestamp: number; // Unix timestamp in ms
  contentType: string; // "text", "link", "file"
}

class LocalDatabase {
  private db: Database | null = null;

  /**
   * Initialize the database and create tables if needed
   */
  init(): void {
    if (this.db) return; // Already initialized

    // Ensure directory exists
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    this.db = new Database(DB_PATH, { create: true });

    // Create local_messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS local_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        content TEXT NOT NULL,
        encrypted_content TEXT NOT NULL,
        is_sent INTEGER NOT NULL,
        status TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        content_type TEXT NOT NULL DEFAULT 'text'
      );
      CREATE INDEX IF NOT EXISTS idx_conversation_timestamp 
        ON local_messages(conversation_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_status 
        ON local_messages(status);
    `);

    logger.info("[local-db] Database initialized at " + DB_PATH);
  }

  /**
   * Store a message locally
   */
  saveMessage(message: LocalMessage): void {
    if (!this.db) this.init();
    const db = this.db;
    if (!db) throw new Error("Database failed to initialize");

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO local_messages 
      (id, conversation_id, content, encrypted_content, is_sent, status, timestamp, content_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      message.id,
      message.conversationId,
      message.content,
      message.encryptedContent,
      message.isSent ? 1 : 0,
      message.status,
      message.timestamp,
      message.contentType
    );
  }

  /**
   * Get all messages for a conversation (sorted by timestamp descending)
   */
  getConversationMessages(conversationId: string): LocalMessage[] {
    if (!this.db) this.init();
    const db = this.db!;

    const stmt = db.prepare(`
      SELECT * FROM local_messages 
      WHERE conversation_id = ? 
      ORDER BY timestamp DESC
    `);

    const rows = stmt.all(conversationId) as Array<{
      id: string;
      conversation_id: string;
      content: string;
      encrypted_content: string;
      is_sent: number;
      status: string;
      timestamp: number;
      content_type: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      content: row.content,
      encryptedContent: row.encrypted_content,
      isSent: row.is_sent === 1,
      status: row.status as "pending" | "sent" | "delivered" | "read",
      timestamp: row.timestamp,
      contentType: row.content_type,
    }));
  }

  /**
   * Get all conversations (returns unique conversation IDs with last message info)
   */
  getConversations(): Array<{
    conversationId: string;
    lastMessage: string;
    lastTimestamp: number;
    unreadCount: number;
  }> {
    if (!this.db) this.init();
    const db = this.db!;

    const rows = db.query(`
      SELECT 
        conversation_id,
        (SELECT content FROM local_messages m2 
         WHERE m2.conversation_id = m1.conversation_id 
         ORDER BY timestamp DESC LIMIT 1) as last_message,
        MAX(timestamp) as last_timestamp,
        SUM(CASE WHEN is_sent = 0 AND status != 'read' THEN 1 ELSE 0 END) as unread_count
      FROM local_messages m1
      GROUP BY conversation_id
      ORDER BY last_timestamp DESC
    `).all() as Array<{
      conversation_id: string;
      last_message: string;
      last_timestamp: number;
      unread_count: number;
    }>;

    return rows.map((row) => ({
      conversationId: row.conversation_id,
      lastMessage: row.last_message,
      lastTimestamp: row.last_timestamp,
      unreadCount: row.unread_count,
    }));
  }

  /**
   * Update message status
   */
  updateMessageStatus(
    messageId: string,
    status: "pending" | "sent" | "delivered" | "read"
  ): void {
    if (!this.db) this.init();
    const db = this.db;
    if (!db) throw new Error("Database failed to initialize");

    const stmt = db.prepare(`
      UPDATE local_messages SET status = ? WHERE id = ?
    `);

    stmt.run(status, messageId);
  }

  /**
   * Mark all messages in a conversation as read
   */
  markConversationAsRead(conversationId: string): void {
    if (!this.db) this.init();
    const db = this.db!;

    const stmt = db.prepare(`
      UPDATE local_messages 
      SET status = 'read' 
      WHERE conversation_id = ? AND is_sent = 0 AND status != 'read'
    `);

    stmt.run(conversationId);
  }

  /**
   * Get a single message by ID
   */
  getMessage(messageId: string): LocalMessage | null {
    if (!this.db) this.init();
    const db = this.db!;

    const stmt = db.prepare(`SELECT * FROM local_messages WHERE id = ?`);
    const row = stmt.get(messageId) as {
      id: string;
      conversation_id: string;
      content: string;
      encrypted_content: string;
      is_sent: number;
      status: string;
      timestamp: number;
      content_type: string;
    } | null;

    if (!row) return null;

    return {
      id: row.id,
      conversationId: row.conversation_id,
      content: row.content,
      encryptedContent: row.encrypted_content,
      isSent: row.is_sent === 1,
      status: row.status as "pending" | "sent" | "delivered" | "read",
      timestamp: row.timestamp,
      contentType: row.content_type,
    };
  }

  /**
   * Delete all local messages (for logout/reset)
   */
  clearAllMessages(): void {
    if (!this.db) this.init();
    const db = this.db!;

    db.exec(`DELETE FROM local_messages`);
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Singleton instance
export const localDb = new LocalDatabase();
