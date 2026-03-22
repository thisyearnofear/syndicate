/**
 * NOTIFICATION SERVICE
 * 
 * Handles notification creation, storage, and retrieval for syndicate members.
 * 
 * Notification Types:
 * - deposit_received: When a member deposits to the pool
 * - distribution_completed: When a prize distribution completes
 * - threshold_met: When Safe multisig threshold is met
 * - win_announced: When syndicate wins lottery
 * - member_joined: When new member joins
 * - system: System announcements
 */

import { sql } from '@vercel/postgres';

export type NotificationType = 
  | 'deposit_received'
  | 'distribution_completed'
  | 'threshold_met'
  | 'win_announced'
  | 'member_joined'
  | 'system';

export interface Notification {
  id: string;
  poolId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface CreateNotificationParams {
  poolId?: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export class NotificationService {

  /**
   * Create a new notification
   */
  async create(params: CreateNotificationParams): Promise<string> {
    try {
      const result = await sql`
        INSERT INTO notifications (
          pool_id,
          type,
          title,
          message,
          data,
          read,
          created_at
        ) VALUES (
          ${params.poolId || null},
          ${params.type},
          ${params.title},
          ${params.message},
          ${params.data ? JSON.stringify(params.data) : null},
          false,
          ${Date.now()}
        )
        RETURNING id
      `;

      return result.rows[0].id;
    } catch (error) {
      console.error('[NotificationService] Failed to create notification:', error);
      // Return a generated ID so the calling code doesn't fail
      return `temp-${Date.now()}`;
    }
  }

  /**
   * Create notification for deposit received
   */
  async notifyDepositReceived(
    poolId: string,
    depositorAddress: string,
    amount: number
  ): Promise<void> {
    await this.create({
      poolId,
      type: 'deposit_received',
      title: 'New Deposit',
      message: `${depositorAddress.slice(0, 6)}… deposited $${amount.toFixed(2)} USDC`,
      data: {
        depositor: depositorAddress,
        amount,
      },
    });
  }

  /**
   * Create notification for distribution completed
   */
  async notifyDistributionCompleted(
    poolId: string,
    amount: number,
    memberCount: number,
    txHash: string
  ): Promise<void> {
    await this.create({
      poolId,
      type: 'distribution_completed',
      title: 'Distribution Complete',
      message: `$${amount.toFixed(2)} USDC distributed to ${memberCount} members`,
      data: {
        amount,
        memberCount,
        txHash,
      },
    });
  }

  /**
   * Create notification for win announced
   */
  async notifyWinAnnounced(
    poolId: string,
    prizeAmount: number
  ): Promise<void> {
    await this.create({
      poolId,
      type: 'win_announced',
      title: 'Lottery Win!',
      message: `Your syndicate won $${prizeAmount.toLocaleString()} in the lottery!`,
      data: {
        prizeAmount,
      },
    });
  }

  /**
   * Create notification for new member joined
   */
  async notifyMemberJoined(
    poolId: string,
    memberAddress: string
  ): Promise<void> {
    await this.create({
      poolId,
      type: 'member_joined',
      title: 'New Member',
      message: `${memberAddress.slice(0, 6)}… joined the syndicate`,
      data: {
        member: memberAddress,
      },
    });
  }

  /**
   * Create notification for Safe threshold met
   */
  async notifyThresholdMet(
    poolId: string,
    txHash: string
  ): Promise<void> {
    await this.create({
      poolId,
      type: 'threshold_met',
      title: 'Transaction Ready',
      message: 'Threshold signatures collected - transaction ready to execute',
      data: {
        txHash,
      },
    });
  }

  /**
   * Get notifications for a user/pool
   */
  async getNotifications(poolId?: string, limit = 50): Promise<Notification[]> {
    try {
      const result = poolId
        ? await sql`
            SELECT id, pool_id, type, title, message, data, read, created_at
            FROM notifications
            WHERE pool_id = ${poolId}
            ORDER BY created_at DESC
            LIMIT ${limit}
          `
        : await sql`
            SELECT id, pool_id, type, title, message, data, read, created_at
            FROM notifications
            ORDER BY created_at DESC
            LIMIT ${limit}
          `;

      return result.rows.map((row: any) => ({
        id: row.id,
        poolId: row.pool_id,
        type: row.type,
        title: row.title,
        message: row.message,
        data: row.data ? (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) : undefined,
        read: row.read,
        createdAt: new Date(row.created_at).toISOString(),
      }));
    } catch (error) {
      console.error('[NotificationService] Failed to get notifications:', error);
      return [];
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(poolId?: string): Promise<number> {
    try {
      const result = poolId
        ? await sql`
            SELECT COUNT(*) as count
            FROM notifications
            WHERE pool_id = ${poolId} AND read = false
          `
        : await sql`
            SELECT COUNT(*) as count
            FROM notifications
            WHERE read = false
          `;

      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      console.error('[NotificationService] Failed to get unread count:', error);
      return 0;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await sql`
        UPDATE notifications
        SET read = true
        WHERE id = ${notificationId}
      `;
    } catch (error) {
      console.error('[NotificationService] Failed to mark as read:', error);
    }
  }

  /**
   * Mark all notifications as read for a pool
   */
  async markAllAsRead(poolId?: string): Promise<void> {
    try {
      if (poolId) {
        await sql`
          UPDATE notifications
          SET read = true
          WHERE pool_id = ${poolId}
        `;
      } else {
        await sql`
          UPDATE notifications
          SET read = true
        `;
      }
    } catch (error) {
      console.error('[NotificationService] Failed to mark all as read:', error);
    }
  }

  /**
   * Delete old notifications (cleanup)
   */
  async deleteOlderThan(days: number): Promise<number> {
    try {
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
      const result = await sql`
        DELETE FROM notifications
        WHERE created_at < ${cutoff}
      `;
      return result.rowCount || 0;
    } catch (error) {
      console.error('[NotificationService] Failed to delete old notifications:', error);
      return 0;
    }
  }
}

export const notificationService = new NotificationService();
