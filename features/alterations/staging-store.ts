"use client";

import { create } from "zustand";

import type { AlterationDescriptor } from "./catalog";

export type StagedAlteration = {
  /** Local-only identity for editing/removing the staged item. */
  id: string;
  descriptor: AlterationDescriptor;
  targetActivityId?: string;
  targetActivityDisplayName?: string;
  /** Raw, untransformed user input keyed by field.key. */
  configValues: Record<string, string>;
};

type State = {
  items: StagedAlteration[];
  add: (item: StagedAlteration) => void;
  update: (item: StagedAlteration) => void;
  remove: (id: string) => void;
  clear: () => void;
};

/**
 * In-memory staging store, lives per editor session. Mirrors the Blazor
 * scoped `AlterationStagingService`. Not persisted across reloads — that's
 * intentional: navigating away discards the draft.
 */
export const useStagingStore = create<State>((set) => ({
  items: [],
  add: (item) => set((s) => ({ items: [...s.items, item] })),
  update: (item) =>
    set((s) => ({
      items: s.items.map((it) => (it.id === item.id ? item : it)),
    })),
  remove: (id) =>
    set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
  clear: () => set({ items: [] }),
}));

/**
 * Build the wire-format JSON for a single staged alteration. Coerces field
 * values according to the descriptor's field kinds.
 */
export function toAlterationJson(
  s: StagedAlteration,
): Record<string, unknown> {
  const out: Record<string, unknown> = { type: s.descriptor.typeId };
  if (s.targetActivityId) out.activityId = s.targetActivityId;

  for (const field of s.descriptor.fields ?? []) {
    const raw = s.configValues[field.key];
    if (raw === undefined || raw === "") continue;
    switch (field.kind) {
      case "Integer":
      case "VersionPicker": {
        const n = Number.parseInt(raw, 10);
        out[field.key] = Number.isFinite(n) ? n : raw;
        break;
      }
      case "Json": {
        try {
          out[field.key] = JSON.parse(raw);
        } catch {
          out[field.key] = raw;
        }
        break;
      }
      default:
        out[field.key] = raw;
    }
  }
  return out;
}

/** One-line summary of a staged alteration's config — used in the Plan-tab cards. */
export function summariseConfig(s: StagedAlteration): string {
  const fields = s.descriptor.fields ?? [];
  if (fields.length === 0) {
    return s.targetActivityDisplayName
      ? `Target: ${s.targetActivityDisplayName}`
      : "No configuration";
  }
  const parts: string[] = [];
  for (const f of fields) {
    const v = s.configValues[f.key];
    if (v === undefined || v === "") continue;
    const trimmed = v.length > 32 ? `${v.slice(0, 32)}…` : v;
    parts.push(`${f.displayName}: ${trimmed}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "No values set";
}
