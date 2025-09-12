"use client";

/**
 * RealTimeService - CLEAN & MODULAR
 * 
 * Centralized real-time data management
 * Single source of truth for live updates
 * 
 * Core Principles:
 * - DRY: Single service for all real-time needs
 * - PERFORMANT: Efficient connection management
 * - CLEAN: Clear separation of concerns
 */

import { megapotService } from './megapot';

export interface RealTimeEvent {
  type: 'jackpot_update' | 'ticket_purchase' | 'syndicate_activity' | 'user_online';
  data: any;
  timestamp: Date;
}

export class RealTimeService {
  private static instance: RealTimeService;
  private listeners: Map<string, Set<(event: RealTimeEvent) => void>> = new Map();
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  static getInstance(): RealTimeService {
    if (!RealTimeService.instance) {
      RealTimeService.instance = new RealTimeService();
    }
    return RealTimeService.instance;
  }

  // PERFORMANT: Subscribe to specific event types
  subscribe(eventType: string, callback: (event: RealTimeEvent) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(callback);
    
    // CLEAN: Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(eventType);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(eventType);
        }
      }
    };
  }

  // MODULAR: Emit events to subscribers
  private emit(eventType: string, data: any) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const event: RealTimeEvent = {
        type: eventType as any,
        data,
        timestamp: new Date(),
      };
      
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.warn('Real-time event callback error:', error);
        }
      });
    }
  }

  // ENHANCEMENT FIRST: Start real-time updates
  start() {
    if (this.isConnected) return;
    
    this.isConnected = true;
    this.startPolling();
  }

  // CLEAN: Stop all real-time updates
  stop() {
    this.isConnected = false;
    this.listeners.clear();
  }

  // PERFORMANT: Smart polling with backoff
  private async startPolling() {
    if (!this.isConnected) return;

    try {
      // ENHANCEMENT FIRST: Fetch latest jackpot data
      const jackpotStats = await megapotService.getActiveJackpotStats();
      this.emit('jackpot_update', jackpotStats);
      
      // DELIGHT: Simulate realistic activity
      this.simulateActivity();
      
      this.reconnectAttempts = 0;
      
      // PERFORMANT: Schedule next update
      setTimeout(() => this.startPolling(), 10000); // 10 seconds
      
    } catch (error) {
      console.warn('Real-time polling error:', error);
      this.handleReconnect();
    }
  }

  // PERFORMANT: Exponential backoff for reconnection
  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    setTimeout(() => {
      if (this.isConnected) {
        this.startPolling();
      }
    }, delay);
  }

  // DELIGHT: Generate realistic activity events
  private simulateActivity() {
    // Ticket purchases
    if (Math.random() < 0.6) {
      this.emit('ticket_purchase', {
        user: `Player${Math.floor(Math.random() * 999)}`,
        amount: Math.floor(Math.random() * 5) + 1,
        timestamp: new Date(),
      });
    }

    // Syndicate activity
    if (Math.random() < 0.3) {
      this.emit('syndicate_activity', {
        syndicate: ['GamingCrew', 'EcoWarriors', 'CryptoFriends'][Math.floor(Math.random() * 3)],
        action: 'member_joined',
        count: Math.floor(Math.random() * 3) + 1,
        timestamp: new Date(),
      });
    }

    // User online count updates
    this.emit('user_online', {
      count: Math.max(150, 234 + Math.floor(Math.random() * 20) - 10),
      timestamp: new Date(),
    });
  }
}

// CLEAN: Export singleton instance
export const realTimeService = RealTimeService.getInstance();