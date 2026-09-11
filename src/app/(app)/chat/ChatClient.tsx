"use client";

import { useState } from "react";

interface Citation {
  marker: number;
  documentId: string;
  documentTitle: string;
  version: number;
  chunkId: string;
  excerpt: string;
}

interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  citations?: Citation[] | null;
}

export function ChatClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<Record<string, "USEFUL" | "INACCURATE">>({});
  const [openCitation, setOpenCitation] = useState<Citation | null>(null);

  async function sendQuestion(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "USER", content: question },
    ]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, sessionId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: "ASSISTANT", content: `Erreur: ${data.error}` },
        ]);
        return;
      }

      setSessionId(data.sessionId);
      setMessages((prev) => [...prev, data.message]);
    } finally {
      setLoading(false);
    }
  }

  async function sendFeedback(messageId: string, rating: "USEFUL" | "INACCURATE") {
    setFeedbackSent((prev) => ({ ...prev, [messageId]: rating }));
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, rating }),
    });
  }

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
        {messages.length === 0 && (
          <p className="text-sm text-slate-400">
            Posez une question sur les procédures, guides ou politiques auxquels vous avez accès.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "USER" ? "text-right" : "text-left"}>
            <div
              className={`inline-block max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                m.role === "USER"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-900"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
            {m.role === "ASSISTANT" && m.citations && m.citations.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {m.citations.map((c) => (
                  <button
                    key={c.chunkId}
                    onClick={() => setOpenCitation(c)}
                    className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    [{c.marker}] {c.documentTitle}
                  </button>
                ))}
              </div>
            )}
            {m.role === "ASSISTANT" && !m.id.startsWith("err-") && (
              <div className="mt-1 flex gap-2 text-xs">
                <button
                  onClick={() => sendFeedback(m.id, "USEFUL")}
                  className={`rounded px-2 py-0.5 ${
                    feedbackSent[m.id] === "USEFUL"
                      ? "bg-green-100 text-green-700"
                      : "text-slate-400 hover:text-green-600"
                  }`}
                >
                  👍 Utile
                </button>
                <button
                  onClick={() => sendFeedback(m.id, "INACCURATE")}
                  className={`rounded px-2 py-0.5 ${
                    feedbackSent[m.id] === "INACCURATE"
                      ? "bg-red-100 text-red-700"
                      : "text-slate-400 hover:text-red-600"
                  }`}
                >
                  👎 Inexact
                </button>
              </div>
            )}
          </div>
        ))}
        {loading && <p className="text-sm text-slate-400">L&apos;assistant réfléchit...</p>}
      </div>

      <form onSubmit={sendQuestion} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Posez votre question..."
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          Envoyer
        </button>
      </form>

      {openCitation && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setOpenCitation(null)}
        >
          <div
            className="max-w-lg rounded-xl bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-slate-900">
              {openCitation.documentTitle}{" "}
              <span className="text-xs font-normal text-slate-400">
                v{openCitation.version}
              </span>
            </h3>
            <p className="mt-2 text-sm text-slate-600">{openCitation.excerpt}...</p>
            <a
              href={`/documents/${openCitation.documentId}`}
              className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline"
            >
              Ouvrir le document →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
