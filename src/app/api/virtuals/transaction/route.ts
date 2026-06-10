import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function getAcpBin(): string {
  return process.env.ACP_BIN_PATH || 'acp';
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.AUTOMATION_API_KEY;
  if (!secret) return true;
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  return token === secret;
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const HEX_RE = /^0x[a-fA-F0-9]*$/;
const SUPPORTED_CHAINS = new Set([1, 8453, 84532, 11155111, 42161]);

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { to, value, data, chainId } = body;

    if (!to || !ADDRESS_RE.test(to)) {
      return NextResponse.json({ error: 'Invalid recipient address' }, { status: 400 });
    }
    if (!chainId || !SUPPORTED_CHAINS.has(Number(chainId))) {
      return NextResponse.json(
        { error: `Unsupported chain ID: ${chainId}. Supported: ${[...SUPPORTED_CHAINS].join(', ')}` },
        { status: 400 }
      );
    }
    if (data && (typeof data !== 'string' || !HEX_RE.test(data))) {
      return NextResponse.json({ error: 'Invalid calldata (must be 0x-prefixed hex)' }, { status: 400 });
    }

    const valueWei = value ?? '0';
    if (typeof valueWei !== 'string' || !/^\d+$/.test(valueWei)) {
      return NextResponse.json({ error: 'Invalid value (must be a decimal wei string)' }, { status: 400 });
    }

    const args = [
      'wallet', 'send-transaction',
      '--chain-id', String(chainId),
      '--to', to,
      '--value', valueWei,
    ];
    if (data) {
      args.push('--data', data);
    }

    const { stdout, stderr } = await execFileAsync(getAcpBin(), args, {
      timeout: 60000,
      env: { ...process.env, HOME: process.env.HOME || '/Users/udingethe' },
    });

    if (stderr && !stderr.includes('Warning')) {
      console.error('[Virtuals Tx] stderr:', stderr);
    }

    let txHash: string | undefined;
    const hashMatch = stdout.match(/0x[a-fA-F0-9]{64}/);
    if (hashMatch) {
      txHash = hashMatch[0];
    }

    return NextResponse.json({ success: true, txHash, output: stdout.trim() });
  } catch (error: any) {
    const message = error.stderr?.trim() || error.stdout?.trim() || error.message;
    console.error('[Virtuals Tx] Failed:', message);
    return NextResponse.json(
      { error: 'Transaction failed', detail: message },
      { status: 500 }
    );
  }
}
