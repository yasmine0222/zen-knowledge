import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @huggingface/transformers (and its native onnxruntime-node dependency)
  // don't bundle correctly on Vercel: Turbopack's tracing/bundling either
  // drops the native .so binary ("libonnxruntime.so.1: cannot open shared
  // object file") or, when force-included via outputFileTracingIncludes,
  // pushes the Hobby plan over its 12-serverless-function limit. Aliasing
  // to the package's WASM-only "web" build (via turbopack.resolveAlias)
  // built without errors but still hit the same runtime error — Turbopack
  // re-processing an already-bundled file doesn't respect the stub
  // conventions its original bundler used.
  //
  // serverExternalPackages is Next's documented mechanism for exactly this
  // class of problem (native bindings: sharp, bcrypt, onnxruntime, etc.):
  // it opts the package out of bundling entirely, so it's `require()`d
  // from node_modules at runtime like a normal Node.js server would, and
  // Vercel copies the whole package — native binaries included — into the
  // function instead of relying on static trace analysis.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
};

export default nextConfig;
