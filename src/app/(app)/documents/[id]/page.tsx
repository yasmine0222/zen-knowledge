import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/requireUser";
import { DocumentActions } from "./DocumentActions";

const VERSION_STATUS_LABEL: Record<string, string> = {
  PROCESSING: "En cours de traitement",
  READY: "Prête",
  FAILED: "Échec",
};

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true, email: true } },
      versions: { orderBy: { version: "desc" } },
    },
  });

  if (!document || document.companyId !== user.companyId) notFound();

  const hasFailedVersion = document.versions.some((v) => v.status === "FAILED");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{document.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {document.department ?? "Toute la société"} · {document.visibility} · propriétaire{" "}
            {document.owner.name}
          </p>
          {document.reviewDueAt && (
            <p className="mt-1 text-xs text-slate-400">
              Révision prévue le {new Date(document.reviewDueAt).toLocaleDateString("fr-FR")}
            </p>
          )}
        </div>
        <DocumentActions documentId={document.id} hasFailedVersion={hasFailedVersion} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Historique des versions</h2>
        <div className="space-y-2">
          {document.versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Version {v.version}{" "}
                  {v.id === document.currentVersionId && (
                    <span className="ml-1 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                      Active
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(v.createdAt).toLocaleString("fr-FR")}
                </p>
                {v.status === "FAILED" && v.errorMessage && (
                  <p className="mt-1 text-xs text-red-600">{v.errorMessage}</p>
                )}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  v.status === "READY"
                    ? "bg-green-100 text-green-700"
                    : v.status === "FAILED"
                      ? "bg-red-100 text-red-700"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {VERSION_STATUS_LABEL[v.status]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
