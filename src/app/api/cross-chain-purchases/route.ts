import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// DEV-ONLY simple file-based store. Replace with DB in production.
const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'cross-chain-purchases.json');

async function ensureStore() {
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch {}
  try { await fs.access(FILE_PATH); } catch { await fs.writeFile(FILE_PATH, '[]', 'utf-8'); }
}

async function readAll(): Promise<Array<Record<string, unknown>>> {
  await ensureStore();
  const content = await fs.readFile(FILE_PATH, 'utf-8');
  try { return JSON.parse(content); } catch { return []; }
}

async function writeAll(items: Array<Record<string, unknown>>) {
  await ensureStore();
  await fs.writeFile(FILE_PATH, JSON.stringify(items, null, 2), 'utf-8');
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get('wallet');
  const all = await readAll();
  if (!wallet) return NextResponse.json(all);
  const filtered = all.filter((i) => {
    const baseWallet = typeof i.baseWallet === 'string' ? i.baseWallet : '';
    const sourceWallet = typeof i.sourceWallet === 'string' ? i.sourceWallet : '';
    const w = wallet.toLowerCase();
    return baseWallet.toLowerCase() === w || sourceWallet.toLowerCase() === w;
  });
  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const all = await readAll();
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      ...body,
    };
    all.push(item);
    await writeAll(all);
    return NextResponse.json(item, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || 'Failed to store mapping' }, { status: 500 });
  }
}
