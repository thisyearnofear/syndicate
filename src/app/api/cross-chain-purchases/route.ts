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

async function readAll(): Promise<any[]> {
  await ensureStore();
  const content = await fs.readFile(FILE_PATH, 'utf-8');
  try { return JSON.parse(content); } catch { return []; }
}

async function writeAll(items: any[]) {
  await ensureStore();
  await fs.writeFile(FILE_PATH, JSON.stringify(items, null, 2), 'utf-8');
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get('wallet');
  const all = await readAll();
  if (!wallet) return NextResponse.json(all);
  const filtered = all.filter((i: any) => (i.baseWallet?.toLowerCase?.() === wallet.toLowerCase()) || (i.sourceWallet?.toLowerCase?.() === wallet.toLowerCase()));
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
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to store mapping' }, { status: 500 });
  }
}
