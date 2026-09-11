"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function DocumentActions({
  documentId,
  hasFailedVersion,
}: {
  documentId: string;
  hasFailedVersion: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function reindex() {
    setBusy(true);
    try {
      await fetch(`/api/documents/${documentId}/reindex`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function uploadNewVersion(file: File) {
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/documents/${documentId}/versions`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Échec de l'envoi de la nouvelle version.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
    <div className="flex flex-col items-end gap-2">
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
        <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          Nouvelle version
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadNewVersion(file);
            }}
          />
        </label>
        <button
          onClick={remove}
          disabled={busy}
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
        >
          Supprimer
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
