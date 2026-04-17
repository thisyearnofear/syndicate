import { sql } from "@vercel/postgres";
import { notFound } from "next/navigation";

interface PendingRow {
  source_tx_id: string | null;
  source_chain: string | null;
  status: string;
  base_tx_id: string | null;
  bridge_id: string | null;
  recipient_base_address: string | null;
  updated_at: string | null;
}

interface AdminPurchasesPageProps {
  searchParams?: {
    token?: string;
    chain?: string;
    status?: string;
    limit?: string;
    offset?: string;
  };
}

export default async function AdminPurchasesPage(props: {
  searchParams: Promise<{
    token?: string;
    chain?: string;
    status?: string;
    limit?: string;
    offset?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret && searchParams?.token !== adminSecret) {
    notFound();
  }

  const chain = searchParams?.chain?.trim();
  const statusFilter = searchParams?.status?.trim();
  const limit = Math.min(Math.max(Number(searchParams?.limit) || 50, 10), 200);
  const offset = Math.max(Number(searchParams?.offset) || 0, 0);

  const where: string[] = [];
  const values: any[] = [];

  if (chain) {
    values.push(chain);
    where.push(`source_chain = $${values.length}`);
  }

  if (statusFilter) {
    values.push(statusFilter);
    where.push(`status = $${values.length}`);
  } else {
    where.push(
      `status IN ('bridging', 'broadcasting', 'confirmed_source', 'confirmed_stacks')`,
    );
  }

  values.push(limit);
  values.push(offset);

  const query = `
    SELECT
      source_tx_id,
      source_chain,
      status,
      base_tx_id,
      bridge_id,
      recipient_base_address,
      updated_at
    FROM purchase_statuses
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY updated_at DESC
    LIMIT $${values.length - 1}
    OFFSET $${values.length};
  `;

  const result = await sql.query<PendingRow>(query, values);

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-white">
            Pending Purchases
          </h1>
          <p className="text-gray-400 mt-2">
            Admin view. Protect this route with auth in production.
          </p>
        </div>

        <form className="flex flex-wrap gap-3 items-end" method="get">
          {adminSecret && (
            <input
              type="hidden"
              name="token"
              value={searchParams?.token || ""}
            />
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Chain</label>
            <input
              name="chain"
              defaultValue={chain || ""}
              placeholder="stacks / solana / near"
              className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Status</label>
            <input
              name="status"
              defaultValue={statusFilter || ""}
              placeholder="bridging / complete"
              className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Limit</label>
            <input
              name="limit"
              defaultValue={String(limit)}
              className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white w-24"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Offset</label>
            <input
              name="offset"
              defaultValue={String(offset)}
              className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white w-24"
            />
          </div>
          <button
            type="submit"
            className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded"
          >
            Apply
          </button>
        </form>

        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-gray-300">
              <tr>
                <th className="text-left px-4 py-3">Chain</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Source Tx</th>
                <th className="text-left px-4 py-3">Base Tx</th>
                <th className="text-left px-4 py-3">Bridge Id</th>
                <th className="text-left px-4 py-3">Recipient</th>
                <th className="text-left px-4 py-3">Updated</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {result.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-gray-400">
                    No pending purchases.
                  </td>
                </tr>
              )}
              {result.rows.map((row, idx) => (
                <tr
                  key={`${row.source_tx_id}-${idx}`}
                  className="text-gray-200"
                >
                  <td className="px-4 py-3">{row.source_chain || "-"}</td>
                  <td className="px-4 py-3">{row.status}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.source_tx_id || "-"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.base_tx_id || "-"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.bridge_id || "-"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.recipient_base_address || "-"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {row.updated_at
                      ? new Date(row.updated_at).toLocaleString()
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {row.source_tx_id && row.source_chain && (
                        <form action="/api/admin/recheck-bridge" method="post">
                          <input
                            type="hidden"
                            name="sourceTxId"
                            value={row.source_tx_id}
                          />
                          <input
                            type="hidden"
                            name="sourceChain"
                            value={row.source_chain}
                          />
                          {row.bridge_id && (
                            <input
                              type="hidden"
                              name="bridgeId"
                              value={row.bridge_id}
                            />
                          )}
                          {adminSecret && (
                            <input
                              type="hidden"
                              name="token"
                              value={searchParams?.token || ""}
                            />
                          )}
                          <button
                            type="submit"
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            Recheck
                          </button>
                        </form>
                      )}
                      {row.source_chain === "stacks" &&
                        row.source_tx_id &&
                        row.recipient_base_address && (
                          <form
                            action="/api/admin/finalize-stacks"
                            method="post"
                          >
                            <input
                              type="hidden"
                              name="stacksTxId"
                              value={row.source_tx_id}
                            />
                            <input
                              type="hidden"
                              name="recipientBaseAddress"
                              value={row.recipient_base_address}
                            />
                            {adminSecret && (
                              <input
                                type="hidden"
                                name="authorization"
                                value={`Bearer ${searchParams?.token || ""}`}
                              />
                            )}
                            <button
                              type="submit"
                              className="text-xs text-indigo-400 hover:text-indigo-300"
                            >
                              Finalize
                            </button>
                          </form>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3 text-sm text-gray-300">
          <a
            href={`?${new URLSearchParams({
              ...(adminSecret ? { token: searchParams?.token || "" } : {}),
              ...(chain ? { chain } : {}),
              ...(statusFilter ? { status: statusFilter } : {}),
              limit: String(limit),
              offset: String(Math.max(offset - limit, 0)),
            }).toString()}`}
            className="hover:text-white"
          >
            Previous
          </a>
          <a
            href={`?${new URLSearchParams({
              ...(adminSecret ? { token: searchParams?.token || "" } : {}),
              ...(chain ? { chain } : {}),
              ...(statusFilter ? { status: statusFilter } : {}),
              limit: String(limit),
              offset: String(offset + limit),
            }).toString()}`}
            className="hover:text-white"
          >
            Next
          </a>
        </div>
      </div>
    </div>
  );
}
