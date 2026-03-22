/**
 * Notifications API
 * 
 * Handles notification CRUD operations:
 * - GET: Fetch notifications and unread count
 * - POST: Create new notifications
 * - PATCH: Mark notifications as read
 */

import { NextResponse } from 'next/server';
import { notificationService } from '@/services/notifications/notificationService';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const action = searchParams.get('action');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (action === 'unread') {
      const count = await notificationService.getUnreadCount(poolId || undefined);
      return NextResponse.json({ unreadCount: count }, { headers: corsHeaders });
    }

    const notifications = await notificationService.getNotifications(
      poolId || undefined,
      limit
    );
    
    const unreadCount = await notificationService.getUnreadCount(poolId || undefined);

    return NextResponse.json({
      notifications,
      unreadCount,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[Notifications API] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, poolId, title, message, data } = body;

    if (!type || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: type, title, message' },
        { status: 400, headers: corsHeaders }
      );
    }

    const id = await notificationService.create({
      poolId,
      type,
      title,
      message,
      data,
    });

    return NextResponse.json({ id, success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('[Notifications API] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { notificationId, markAllRead, poolId } = body;

    if (markAllRead) {
      await notificationService.markAllAsRead(poolId);
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    if (!notificationId) {
      return NextResponse.json(
        { error: 'Missing notificationId' },
        { status: 400, headers: corsHeaders }
      );
    }

    await notificationService.markAsRead(notificationId);
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('[Notifications API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
