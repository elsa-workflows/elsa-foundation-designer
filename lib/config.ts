import { z } from "zod";

import type {
  ClientEngineSeed,
  ServerEngineEntry,
} from "@/lib/engines/types";

const engineEntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  url: z.string().url(),
});

const enginesListSchema = z.array(engineEntrySchema).min(1);

function parseEnginesEnv(
  raw: string | undefined,
  varName: string,
): ServerEngineEntry[] | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch (err) {
    const preview =
      trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;
    const reason = err instanceof Error ? err.message : "unknown JSON error";
    throw new Error(
      `Invalid ${varName}: not valid JSON (${reason}). Expected an array like [{"id":"local","label":"Local","url":"http://localhost:5001/elsa/api"}]. Received: ${preview}`,
    );
  }
  const parsed = enginesListSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Invalid ${varName}: ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data.map((e) => ({
    id: e.id,
    label: e.label,
    url: e.url.replace(/\/$/, ""),
  }));
}

const serverSchema = z.object({
  ELSA_API_URL: z.string().url(),
  ELSA_ENGINES: z.string().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_ELSA_API_URL: z.string().url(),
  NEXT_PUBLIC_ELSA_ENGINES: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema> & {
  engines: ServerEngineEntry[];
};
export type ClientEnv = z.infer<typeof clientSchema> & {
  engines: ClientEngineSeed[];
};

/**
 * Server-only env. Lazy: validated on first access, never at import time, so
 * that this module can be safely imported from client components that only
 * need `clientEnv` / `COOKIES`.
 */
let cachedServerEnv: ServerEnv | null = null;
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() called from the browser");
  }
  if (cachedServerEnv) return cachedServerEnv;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid server env: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  }
  const explicit = parseEnginesEnv(parsed.data.ELSA_ENGINES, "ELSA_ENGINES");
  const engines: ServerEngineEntry[] =
    explicit ??
    [
      {
        id: "default",
        label: "Default",
        url: parsed.data.ELSA_API_URL.replace(/\/$/, ""),
      },
    ];
  cachedServerEnv = { ...parsed.data, engines };
  return cachedServerEnv;
}

function buildClientEnv(): ClientEnv {
  const parsed = clientSchema.parse({
    NEXT_PUBLIC_ELSA_API_URL: process.env.NEXT_PUBLIC_ELSA_API_URL,
    NEXT_PUBLIC_ELSA_ENGINES: process.env.NEXT_PUBLIC_ELSA_ENGINES,
  });
  const explicit = parseEnginesEnv(
    parsed.NEXT_PUBLIC_ELSA_ENGINES,
    "NEXT_PUBLIC_ELSA_ENGINES",
  );
  const engines: ClientEngineSeed[] =
    explicit ??
    [
      {
        id: "default",
        label: "Default",
        url: parsed.NEXT_PUBLIC_ELSA_API_URL.replace(/\/$/, ""),
      },
    ];
  return { ...parsed, engines };
}

/** Browser-safe env (the NEXT_PUBLIC_* mirrors). */
export const clientEnv: ClientEnv = buildClientEnv();

export const COOKIES = {
  /**
   * Legacy single-engine access-token cookie. Kept exported so older code
   * paths that haven't been migrated still compile, but new code should use
   * `accessTokenFor(engineId)` instead.
   */
  accessToken: "elsa_at",
  refreshToken: "elsa_rt",
  activeEngine: "elsa_active_engine",
} as const;

export function accessTokenCookieName(engineId: string): string {
  return `elsa_at_${engineId}`;
}

export function refreshTokenCookieName(engineId: string): string {
  return `elsa_rt_${engineId}`;
}

/**
 * Marker cookie that records the user's "Remember me" choice for an engine.
 * Stores `"1"` for persistent (30-day) sessions and `"0"` for session
 * cookies that vanish when the browser closes. Read by /api/auth/refresh
 * and /api/auth/me so they re-issue cookies with the same lifetime mode.
 */
export function persistMarkerCookieName(engineId: string): string {
  return `elsa_persist_${engineId}`;
}
