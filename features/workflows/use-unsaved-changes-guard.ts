"use client";

import { useEffect } from "react";

import { useEditorStore } from "@/features/workflows/editor-store";

/** Browser-level "unsaved changes" warning on tab close / reload. */
export function useUnsavedChangesGuard() {
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!useEditorStore.getState().isDirty) return;
      e.preventDefault();
      // Modern browsers ignore the message but require returnValue to be set.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
}
