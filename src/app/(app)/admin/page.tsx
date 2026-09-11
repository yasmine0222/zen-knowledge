import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/requireUser";
import { getAdminStats } from "@/lib/admin/stats";

export default async function AdminPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN" || !user.companyId) redirect("/chat");

  const stats = await getAdminStats(user.companyId);

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-slate-900">Administration</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Requêtes (500 dernières)" value={stats.totalQueries.toString()} />
        <StatCard
          label="Coût estimé"
          value={`$${stats.estimatedCostUsd.toFixed(4)}`}
        />
        <StatCard
          label="Documents à réviser"
          value={stats.obsoleteQueue.length.toString()}
        />
      </div>

      <Section title="Erreurs d'ingestion">
        {stats.failedVersions.length === 0 ? (
          <EmptyRow text="Aucune erreur d'ingestion." />
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {stats.failedVersions.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">{v.document.title}</td>
                  <td className="px-4 py-2 text-slate-500">v{v.version}</td>
                  <td className="px-4 py-2 text-red-600">{v.errorMessage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Questions sans résultat">
        {stats.zeroResultLogs.length === 0 ? (
          <EmptyRow text="Aucune question sans réponse sourcée récemment." />
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {stats.zeroResultLogs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-2 text-slate-900">{log.question}</td>
                  <td className="px-4 py-2 text-slate-400">
                    {new Date(log.createdAt).toLocaleString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Documents obsolètes / à réviser">
        {stats.obsoleteQueue.length === 0 ? (
          <EmptyRow text="Aucun document en attente de révision." />
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {stats.obsoleteQueue.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-4 py-2">
                    <Link href={`/documents/${doc.id}`} className="font-medium text-indigo-600">
                      {doc.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-500">
                    échéance {doc.reviewDueAt ? new Date(doc.reviewDueAt).toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-400">
                    {doc.reminderSentAt ? "Rappel envoyé" : "Rappel non envoyé"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-slate-700">{title}</h2>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {children}
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-4 py-6 text-center text-sm text-slate-400">{text}</p>;
}
