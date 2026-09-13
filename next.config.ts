import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @huggingface/transformers unconditionally requires onnxruntime-node at
  // module load time in its Node.js build (regardless of the `device`
  // option passed to pipeline()). Next's output file tracing doesn't pick
  // up its native .so binary automatically, so serverless functions that
  // import it (chat, document ingestion) fail with "libonnxruntime.so.1:
  // cannot open shared object file" on Vercel. Force-include it.
  outputFileTracingIncludes: {
    "/api/chat": ["./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**"],
    "/api/documents": ["./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**"],
    "/api/documents/[id]/versions": [
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**",
    ],
    "/api/documents/[id]/reindex": [
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**",
    ],
    "/api/internal/ingest": ["./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**"],
  },
};

export default nextConfig;
