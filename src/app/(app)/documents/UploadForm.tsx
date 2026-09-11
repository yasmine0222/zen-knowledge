"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function UploadForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch("/api/documents", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'envoi.");
        return;
      }
      form.reset();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-slate-600">Titre</label>
        <input
          name="title"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Service (optionnel)</label>
        <input
          name="department"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="RH, Finance, IT..."
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Visibilité</label>
        <select
          name="visibility"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="COMPANY">Toute la société</option>
          <option value="DEPARTMENT">Service uniquement</option>
          <option value="PRIVATE">Privé (moi uniquement)</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-slate-600">
          Fichier (PDF, DOCX, TXT, MD)
        </label>
        <input
          type="file"
          name="file"
          required
          accept=".pdf,.docx,.txt,.md"
          className="mt-1 w-full text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {submitting ? "Envoi..." : "Ingérer le document"}
        </button>
      </div>
    </form>
  );
}
