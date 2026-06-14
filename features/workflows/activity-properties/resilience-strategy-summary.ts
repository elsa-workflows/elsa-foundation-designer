import type { ResilienceStrategyDescriptor } from "@/lib/api/types";

/**
 * Build a short human-readable summary of a resilience strategy's config —
 * "3 attempts · exponential · 1 s base · jitter on" — so the dropdown items
 * can show what each strategy actually *does*, not just its display name.
 *
 * Falls back to nothing when none of the known fields are present (custom
 * strategy types we don't have a hard-coded summary for); callers can render
 * the `$type` name in that case.
 */
export function summarizeStrategy(d: ResilienceStrategyDescriptor): string | null {
  const parts: string[] = [];
  if (typeof d.maxRetryAttempts === "number") {
    parts.push(
      d.maxRetryAttempts === 1 ? "1 attempt" : `${d.maxRetryAttempts} attempts`,
    );
  }
  if (typeof d.backoffType === "string") {
    parts.push(d.backoffType.toLowerCase());
  }
  const delayLabel = formatIsoDuration(d.delay);
  if (delayLabel) parts.push(`${delayLabel} base`);
  if (d.useJitter === true) parts.push("jitter");
  return parts.length === 0 ? null : parts.join(" · ");
}

/**
 * Render an ISO-8601 / .NET TimeSpan duration ("00:00:01.5", "PT2S") as a
 * compact label like "1.5 s" or "2 m". Returns null for shapes we don't
 * recognise so callers can decide whether to fall back.
 */
function formatIsoDuration(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  // .NET TimeSpan: "HH:MM:SS" or "HH:MM:SS.fffffff"
  const dotnet = /^(\d+):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(raw);
  if (dotnet) {
    const [, h, m, s, frac] = dotnet;
    const totalSec = +h * 3600 + +m * 60 + +s + (frac ? +`0.${frac}` : 0);
    return prettySeconds(totalSec);
  }
  // ISO-8601 duration ("PT2S", "PT1M30S", "PT1H")
  const iso = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(raw);
  if (iso) {
    const [, h, m, s] = iso;
    const totalSec = (h ? +h * 3600 : 0) + (m ? +m * 60 : 0) + (s ? +s : 0);
    return prettySeconds(totalSec);
  }
  return null;
}

function prettySeconds(s: number): string {
  if (s >= 60) {
    const m = s / 60;
    return Number.isInteger(m) ? `${m} m` : `${m.toFixed(1)} m`;
  }
  if (s >= 1) {
    return Number.isInteger(s) ? `${s} s` : `${s.toFixed(s < 10 ? 1 : 0)} s`;
  }
  return `${Math.round(s * 1000)} ms`;
}
