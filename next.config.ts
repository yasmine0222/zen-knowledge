import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @huggingface/transformers' Node.js build unconditionally requires
  // onnxruntime-node (a native .so binary) at module load time, regardless
  // of the `device` option passed to pipeline() — fine in Docker/local dev,
  // but Vercel's serverless bundling doesn't carry the binary over
  // ("libonnxruntime.so.1: cannot open shared object file"). Forcing it in
  // via outputFileTracingIncludes worked but pushed the Hobby plan over its
  // 12-serverless-function limit (apparently by breaking whatever route
  // bundling let 18 routes fit into 12 functions).
  //
  // Redirect the import at the bundler level to the package's own "web"
  // build instead — same feature-extraction API, but WASM-only (no native
  // dependency at all), so nothing needs tracing or bundling specially.
  // This is @huggingface/transformers' own documented path for
  // environments where the native Node build doesn't fit.
  // Turbopack rejects absolute filesystem paths here ("server relative
  // imports are not implemented yet") — must be relative to the project
  // root (where this file lives), not an OS path.
  turbopack: {
    resolveAlias: {
      "@huggingface/transformers":
        "./node_modules/@huggingface/transformers/dist/transformers.web.js",
    },
  },
};

export default nextConfig;
