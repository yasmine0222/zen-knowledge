import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @huggingface/transformers' native onnxruntime-node dependency does not
  // reach Vercel's serverless functions correctly — confirmed across four
  // approaches (forcing the WASM backend, outputFileTracingIncludes,
  // aliasing to the package's WASM-only build, and this option) that the
  // deployed function still fails with "libonnxruntime.so.1: cannot open
  // shared object file". serverExternalPackages is Next's documented fix
  // for exactly this class of problem (native bindings: sharp, bcrypt,
  // onnxruntime, etc.) and is kept because it's still correct practice —
  // it just isn't sufficient on its own here. See README limitations for
  // the full story and what this means for the deployed demo.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
};

export default nextConfig;
