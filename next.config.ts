import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @huggingface/transformers unconditionally requires onnxruntime-node at
  // module load time in its Node.js build (regardless of the `device`
  // option passed to pipeline()). Next's output file tracing doesn't pick
  // up its native .so binary automatically, so serverless functions that
  // import it (chat, document ingestion) fail with "libonnxruntime.so.1:
  // cannot open shared object file" on Vercel. Force-include it.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/onnxruntime-node/bin/**/*"],
  },
};

export default nextConfig;
