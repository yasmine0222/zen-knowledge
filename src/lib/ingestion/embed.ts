import type { FeatureExtractionPipeline } from "@huggingface/transformers";

export const EMBEDDING_DIM = 384;
// Multilingual E5 significantly outperforms all-MiniLM-L6-v2 on this corpus
// for cross-lingual retrieval (French questions over English documents, and
// vice versa) — measured: a French question about an English CV scored 0.83+
// against the right passage and separated cleanly (~0.06-0.07 gap) from
// unrelated passages, where MiniLM scored 0.39 (below any usable threshold)
// and didn't even rank the CV in the top results. Same 384-dim output, so no
// pgvector schema change needed.
const MODEL_NAME = "Xenova/multilingual-e5-small";

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

/**
 * Local, in-process embedding model (no external API key). Loaded once and
 * cached for the lifetime of the server process.
 */
async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = import("@huggingface/transformers").then(({ pipeline }) =>
      // Force the WASM backend explicitly: the default "cpu" device pulls in
      // onnxruntime-node's native .so binary, which Vercel's serverless
      // function bundling doesn't carry over ("libonnxruntime.so.1: cannot
      // open shared object file"). WASM has no native dependency and runs
      // the same everywhere — local dev, Docker, and serverless alike.
      pipeline("feature-extraction", MODEL_NAME, { device: "wasm" })
    );
  }
  return extractorPromise;
}

async function embed(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

// E5 models require this exact "query: " / "passage: " prefix convention to
// perform as trained — asymmetric search (a short question against a longer
// passage) degrades badly without it. See the model card for details.
export async function embedQuery(text: string): Promise<number[]> {
  return embed(`query: ${text}`);
}

export async function embedPassage(text: string): Promise<number[]> {
  return embed(`passage: ${text}`);
}

export async function embedPassageBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await embedPassage(text));
  }
  return results;
}

/** Formats a vector as a pgvector literal for raw SQL, e.g. '[0.1,0.2,...]'. */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
