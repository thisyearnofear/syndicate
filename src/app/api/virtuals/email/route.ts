import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function getAcpBin(): string {
  return process.env.ACP_BIN_PATH || 'acp';
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.AUTOMATION_API_KEY;
  // Fail closed: an unauthenticated route that can send email as the agent is
  // worse than a disabled one. Set AUTOMATION_API_KEY to enable this route.
  if (!secret) return false;
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  return token === secret;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  if (!process.env.AUTOMATION_API_KEY) {
    return NextResponse.json(
      { error: 'Email route disabled: AUTOMATION_API_KEY is not configured on the server.' },
      { status: 503 }
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { to, subject, body: emailBody } = body;

    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      );
    }

    if (typeof to !== 'string' || !EMAIL_RE.test(to)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    if (typeof subject !== 'string' || subject.length > 500) {
      return NextResponse.json({ error: 'Invalid subject' }, { status: 400 });
    }
    if (typeof emailBody !== 'string' || emailBody.length > 50000) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const { stdout, stderr } = await execFileAsync(getAcpBin(), [
      'email', 'compose',
      '--to', to,
      '--subject', subject,
      '--body', emailBody,
    ], { timeout: 30000, env: { ...process.env, HOME: process.env.HOME || '/Users/udingethe' } });

    if (stderr && !stderr.includes('Warning')) {
      console.error('[Virtuals Email] stderr:', stderr);
    }

    return NextResponse.json({ success: true, output: stdout.trim() });
  } catch (error: any) {
    const message = error.stderr?.trim() || error.stdout?.trim() || error.message;
    console.error('[Virtuals Email] Failed:', message);
    return NextResponse.json(
      { error: 'Failed to send email', detail: message },
      { status: 500 }
    );
  }
}
