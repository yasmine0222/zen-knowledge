/**
 * Rough cost estimation for the admin dashboard. Rates are approximate
 * (USD per 1M tokens) and should be adjusted to your actual Groq pricing tier.
 */
const RATES_PER_MILLION_TOKENS: Record<string, { in: number; out: number }> = {
  "llama-3.3-70b-versatile": { in: 0.59, out: 0.79 },
  "llama-3.1-8b-instant": { in: 0.05, out: 0.08 },
};
const DEFAULT_RATE = { in: 0.6, out: 0.8 };

export function estimateCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const rate = RATES_PER_MILLION_TOKENS[model] ?? DEFAULT_RATE;
  return (tokensIn * rate.in + tokensOut * rate.out) / 1_000_000;
}
