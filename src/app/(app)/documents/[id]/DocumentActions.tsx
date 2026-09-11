"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DocumentActions({
  documentId,
  hasFailedVersion,
}: {
  documentId: string;
  hasFailedVersion: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reindex() {
    setBusy(true);
    try {
      await fetch(`/api/documents/${documentId}/reindex`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Supprimer ce document ? Il sera exclu de la recherche mais l'historique des citations sera conservé.")) {
      return;
    }
    setBusy(true);
    try {
      await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
      router.push("/documents");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      {hasFailedVersion && (
        <button
          onClick={reindex}
          disabled={busy}
          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
        >
          Réessayer l&apos;indexation
        </button>
      )}
      <button
        onClick={remove}
        disabled={busy}
        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
      >
        Supprimer
      </button>
    </div>
  );
}
