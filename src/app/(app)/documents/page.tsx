import Link from "next/link";
import { requireUser } from "@/lib/auth/requireUser";
import { listVisibleDocuments } from "@/lib/documents/listVisible";
import { UploadForm } from "./UploadForm";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  PUBLISHED: "Publié",
  OBSOLETE: "Obsolète",
  DELETED: "Supprimé",
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PUBLISHED: "bg-green-100 text-green-700",
  OBSOLETE: "bg-amber-100 text-amber-700",
  DELETED: "bg-red-100 text-red-700",
};

export default async function DocumentsPage() {
  const user = await requireUser();
  const documents = await listVisibleDocuments(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-4 text-lg font-semibold text-slate-900">Bibliothèque documentaire</h1>
        <UploadForm />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Titre</th>
              <th className="px-4 py-2">Service</th>
              <th className="px-4 py-2">Visibilité</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Propriétaire</th>
              <th className="px-4 py-2">Mise à jour</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/documents/${doc.id}`} className="font-medium text-indigo-600">
                    {doc.title}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-500">{doc.department ?? "—"}</td>
                <td className="px-4 py-2 text-slate-500">{doc.visibility}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[doc.status]}`}
                  >
                    {STATUS_LABEL[doc.status]}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-500">{doc.owner.name}</td>
                <td className="px-4 py-2 text-slate-500">
                  {new Date(doc.updatedAt).toLocaleDateString("fr-FR")}
                </td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Aucun document pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
