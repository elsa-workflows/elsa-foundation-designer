"use client";

import { clientEnv } from "@/lib/config";
import type { ClientEngineSeed, EngineDescriptor } from "@/lib/engines/types";

const STORAGE_KEY = "elsa.engines.user.v1";

type StoredUserEngine = {
  id: string;
  label: string;
  url: string;
};

type Listener = (engines: EngineDescriptor[]) => void;

const listeners = new Set<Listener>();

/**
 * Server-allowlist mirror baked into the client bundle. The browser cannot
 * sneak around it — the auth route handlers re-check server-side — but we
 * use it here to flag user-added engines whose URLs aren't authorised, so
 * the UI can grey out the login affordance for them.
 *
 * Sourced from the *same* env list as the seed engines: anything that
 * appears in `NEXT_PUBLIC_ELSA_ENGINES` is also expected to appear in the
 * server's `ELSA_ENGINES`. Ops sets both together.
 */
const ALLOWLISTED_URLS = new Set(
  clientEnv.engines.map((e) => e.url.replace(/\/$/, "")),
);

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function readUserEngines(): StoredUserEngine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is StoredUserEngine =>
        e &&
        typeof e.id === "string" &&
        typeof e.label === "string" &&
        typeof e.url === "string",
    );
  } catch {
    return [];
  }
}

function writeUserEngines(entries: StoredUserEngine[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function envSeedDescriptors(): EngineDescriptor[] {
  return clientEnv.engines.map((e: ClientEngineSeed) => ({
    id: e.id,
    label: e.label,
    url: normalizeUrl(e.url),
    source: "env" as const,
    serverAllowlisted: true,
  }));
}

function userDescriptors(): EngineDescriptor[] {
  const envIds = new Set(clientEnv.engines.map((e) => e.id));
  return readUserEngines()
    // Defensive: if an env-seeded engine collides with a stored user one,
    // the env entry wins. Drop the stored copy.
    .filter((e) => !envIds.has(e.id))
    .map((e) => ({
      id: e.id,
      label: e.label,
      url: normalizeUrl(e.url),
      source: "user" as const,
      serverAllowlisted: ALLOWLISTED_URLS.has(normalizeUrl(e.url)),
    }));
}

export function getAllEngines(): EngineDescriptor[] {
  return [...envSeedDescriptors(), ...userDescriptors()];
}

export function getEngineById(id: string): EngineDescriptor | null {
  return getAllEngines().find((e) => e.id === id) ?? null;
}

function notify() {
  const snapshot = getAllEngines();
  for (const l of listeners) l(snapshot);
}

export function subscribeEngines(listener: Listener): () => void {
  listeners.add(listener);
  listener(getAllEngines());
  return () => {
    listeners.delete(listener);
  };
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `eng_${Math.random().toString(36).slice(2, 10)}`;
}

export class EngineRegistryError extends Error {
  constructor(
    public readonly code: "invalid-url" | "duplicate-url" | "not-found" | "immutable",
    message: string,
  ) {
    super(message);
    this.name = "EngineRegistryError";
  }
}

function validateUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new EngineRegistryError("invalid-url", "URL must be http(s).");
    }
    return normalizeUrl(u.toString());
  } catch (err) {
    if (err instanceof EngineRegistryError) throw err;
    throw new EngineRegistryError("invalid-url", "Enter a valid URL.");
  }
}

export function addUserEngine(input: {
  label: string;
  url: string;
}): EngineDescriptor {
  const url = validateUrl(input.url);
  const all = getAllEngines();
  if (all.some((e) => normalizeUrl(e.url) === url)) {
    throw new EngineRegistryError(
      "duplicate-url",
      "An engine with this URL already exists.",
    );
  }
  const entry: StoredUserEngine = {
    id: generateId(),
    label: input.label.trim() || url,
    url,
  };
  writeUserEngines([...readUserEngines(), entry]);
  notify();
  return {
    id: entry.id,
    label: entry.label,
    url: entry.url,
    source: "user",
    serverAllowlisted: ALLOWLISTED_URLS.has(entry.url),
  };
}

export function updateUserEngine(
  id: string,
  patch: { label?: string; url?: string },
): void {
  const stored = readUserEngines();
  const idx = stored.findIndex((e) => e.id === id);
  if (idx < 0) {
    throw new EngineRegistryError("not-found", "Engine not found.");
  }
  const next = { ...stored[idx] };
  if (patch.label !== undefined) next.label = patch.label.trim() || next.label;
  if (patch.url !== undefined) {
    const url = validateUrl(patch.url);
    const dup = getAllEngines().find(
      (e) => normalizeUrl(e.url) === url && e.id !== id,
    );
    if (dup) {
      throw new EngineRegistryError(
        "duplicate-url",
        "An engine with this URL already exists.",
      );
    }
    next.url = url;
  }
  const copy = stored.slice();
  copy[idx] = next;
  writeUserEngines(copy);
  notify();
}

export function removeUserEngine(id: string): void {
  const stored = readUserEngines();
  if (!stored.some((e) => e.id === id)) {
    if (clientEnv.engines.some((e) => e.id === id)) {
      throw new EngineRegistryError(
        "immutable",
        "Env-provisioned engines cannot be removed from the UI.",
      );
    }
    throw new EngineRegistryError("not-found", "Engine not found.");
  }
  writeUserEngines(stored.filter((e) => e.id !== id));
  notify();
}

/** First env-seeded engine — used as the default active engine. */
export function getDefaultEngineId(): string {
  return clientEnv.engines[0]?.id ?? "default";
}
