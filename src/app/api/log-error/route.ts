/**
 * Basic Error Logging API Endpoint
 * Temporary endpoint for error logging until proper monitoring is set up
 */

import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate the request body
    if (!body || !body.error || !body.error.message) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const errorData = {
      timestamp: body.timestamp || new Date().toISOString(),
      error: body.error,
      context: body.context || {},
      userAgent: request.headers.get('user-agent') || 'unknown',
      ip: request.ip || 'unknown',
    };

    // Log to console for immediate visibility
    console.error('🚨 API Error Log:', JSON.stringify(errorData, null, 2));

    // Save to file for persistence (in development)
    if (process.env.NODE_ENV !== 'production') {
      try {
        const logsDir = join(process.cwd(), 'logs');
        await mkdir(logsDir, { recursive: true });
        
        const logFile = join(logsDir, `errors-${new Date().toISOString().split('T')[0]}.log`);
        const logEntry = `${new Date().toISOString()} - ${JSON.stringify(errorData)}\n\n`;
        
        await writeFile(logFile, logEntry, { flag: 'a' });
      } catch (fileError) {
        console.error('Failed to write error log to file:', fileError);
      }
    }

    // In production, you would send this to a proper logging service
    // For now, we'll just return success
    return NextResponse.json(
      { success: true, message: 'Error logged successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in log-error endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Allow GET requests for testing
export async function GET() {
  return NextResponse.json(
    {
      success: true,
      message: 'Error logging endpoint is active',
      methods: ['POST'],
    },
    { status: 200 }
  );
}