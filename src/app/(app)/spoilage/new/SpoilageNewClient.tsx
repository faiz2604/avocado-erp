"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordSpoilageAction } from "@/actions/spoilage";
import { formatKg } from "@/lib/constants";
import { SPOILAGE_REASONS } from "@/lib/constants";

type BatchOption = { id: string; code: string; productName: string; qty: number };

export default function SpoilageNewClient({ batches }: { batches: BatchOption[] }) {
  const router = useRouter();
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState<string>(SPOILAGE_REASONS[0]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = batches.find((b) => b.id === batchId);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await recordSpoilageAction({ batchId, quantity, reason, notes: notes || undefined });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/spoilage");
    });
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 max-w-lg">
      {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
      <div>
        <label className="label">Batch</label>
        <select className="input" value={batchId} onChange={(e) => setBatchId(e.target.value)} required>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>{b.code} — {b.productName} ({formatKg(b.qty)} tersedia)</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Quantity Rusak (kg)</label>
        <input className="input" type="number" value={quantity || ""} max={selected?.qty} onChange={(e) => setQuantity(Number(e.target.value))} required />
      </div>
      <div>
        <label className="label">Alasan</label>
        <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
          {SPOILAGE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Catatan</label>
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <button className="btn-primary w-full" type="submit" disabled={pending || !batchId}>
        {pending ? "Menyimpan..." : "Simpan Spoilage"}
      </button>
    </form>
  );
}
