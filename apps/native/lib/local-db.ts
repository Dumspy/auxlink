/**
 * Local SQLite database for storing message history on device
 * Uses expo-sqlite for persistent storage
 */

import * as SQLite from "expo-sqlite";

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
  private db: SQLite.SQLiteDatabase | null = null;

  /**
   * Initialize the database and create tables if needed
   */
  async init(): Promise<void> {
    if (this.db) return; // Already initialized

    this.db = await SQLite.openDatabaseAsync("auxlink.db");

    // Create local_messages table
    await this.db.execAsync(`
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

    console.log("[local-db] Database initialized");
  }

  /**
   * Store a message locally
   */
  async saveMessage(message: LocalMessage): Promise<void> {
    if (!this.db) await this.init();
    const db = this.db;
    if (!db) throw new Error("Database failed to initialize");

    await db.runAsync(
      `INSERT OR REPLACE INTO local_messages 
       (id, conversation_id, content, encrypted_content, is_sent, status, timestamp, content_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        message.id,
        message.conversationId,
        message.content,
        message.encryptedContent,
        message.isSent ? 1 : 0,
        message.status,
        message.timestamp,
        message.contentType,
      ]
    );
  }

  /**
   * Get all messages for a conversation (sorted by timestamp descending)
   */
  async getConversationMessages(conversationId: string): Promise<LocalMessage[]> {
    if (!this.db) await this.init();
    const db = this.db!;

    const rows = await db.getAllAsync<{
      id: string;
      conversation_id: string;
      content: string;
      encrypted_content: string;
      is_sent: number;
      status: string;
      timestamp: number;
      content_type: string;
    }>(
      `SELECT * FROM local_messages 
       WHERE conversation_id = ? 
       ORDER BY timestamp DESC`,
      [conversationId]
    );

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
  async getConversations(): Promise<
    Array<{
      conversationId: string;
      lastMessage: string;
      lastTimestamp: number;
      unreadCount: number;
    }>
  > {
    if (!this.db) await this.init();
    const db = this.db!;

    const rows = await db.getAllAsync<{
      conversation_id: string;
      last_message: string;
      last_timestamp: number;
      unread_count: number;
    }>(`
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
    `);

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
  async updateMessageStatus(
    messageId: string,
    status: "pending" | "sent" | "delivered" | "read"
  ): Promise<void> {
    if (!this.db) await this.init();
    const db = this.db;
    if (!db) throw new Error("Database failed to initialize");

    await db.runAsync(
      `UPDATE local_messages SET status = ? WHERE id = ?`,
      [status, messageId]
    );
  }

  /**
   * Mark all messages in a conversation as read
   */
  async markConversationAsRead(conversationId: string): Promise<void> {
    if (!this.db) await this.init();
    const db = this.db!;

    await db.runAsync(
      `UPDATE local_messages 
       SET status = 'read' 
       WHERE conversation_id = ? AND is_sent = 0 AND status != 'read'`,
      [conversationId]
    );
  }

  /**
   * Get a single message by ID
   */
  async getMessage(messageId: string): Promise<LocalMessage | null> {
    if (!this.db) await this.init();
    const db = this.db!;

    const row = await db.getFirstAsync<{
      id: string;
      conversation_id: string;
      content: string;
      encrypted_content: string;
      is_sent: number;
      status: string;
      timestamp: number;
      content_type: string;
    }>(`SELECT * FROM local_messages WHERE id = ?`, [messageId]);

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
  async clearAllMessages(): Promise<void> {
    if (!this.db) await this.init();
    const db = this.db!;

    await db.execAsync(`DELETE FROM local_messages`);
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }
}

// Singleton instance
export const localDb = new LocalDatabase();
