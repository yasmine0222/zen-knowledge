import { runIngestionPipeline } from "@/lib/ingestion/pipeline";
import { verifyInternalSecret, unauthorizedInternal } from "@/lib/internalAuth";

/** Called by the n8n `ingestion-pipeline` workflow after a document is uploaded. */
export async function POST(request: Request) {
  if (!verifyInternalSecret(request)) return unauthorizedInternal();

  const body = await request.json();
  const documentVersionId: string | undefined = body.documentVersionId;
  if (!documentVersionId) {
    return Response.json({ error: "documentVersionId manquant." }, { status: 400 });
  }

  try {
    await runIngestionPipeline(documentVersionId);
    return Response.json({ ok: true, status: "READY" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur d'ingestion";
    return Response.json({ ok: false, status: "FAILED", error: message }, { status: 200 });
  }
}
