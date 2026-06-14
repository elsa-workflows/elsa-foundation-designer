import type { ActivityJson, InputDescriptor } from "@/lib/api/types";

/**
 * The bag of data every hint-control receives. It carries the descriptor, the
 * activity it belongs to, and a single setter that performs the write back
 * into the editor store. Mirrors `DisplayInputEditorContext` from the Blazor
 * studio.
 */
export type HintContext = {
  activity: ActivityJson;
  descriptor: InputDescriptor;
  readOnly: boolean;
  /** Replace the input's value at `camelize(descriptor.name)` on the activity. */
  setRaw: (next: unknown) => void;
};
