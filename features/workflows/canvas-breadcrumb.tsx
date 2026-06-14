"use client";

import { ChevronRight, Home } from "lucide-react";
import { Fragment } from "react";

import { useEditorStore } from "@/features/workflows/editor-store";

/**
 * Path renderer for the container-drilling stack. Stays hidden at the
 * workflow root — only the surface of `containerStack.length > 0` produces
 * the strip. Clicking a segment truncates the stack and re-orients the
 * canvas (see `popToContainer` / `popContainer` in the store).
 */
export function CanvasBreadcrumb() {
  const stack = useEditorStore((s) => s.containerStack);
  const popTo = useEditorStore((s) => s.popToContainer);
  const definitionName = useEditorStore((s) => s.definition?.name);

  if (stack.length === 0) return null;

  return (
    <nav
      aria-label="Container path"
      className="bg-muted/30 flex items-center gap-1 border-b px-3 py-1.5 text-xs"
    >
      <button
        type="button"
        onClick={() => popTo(-1)}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors"
        title="Back to workflow root"
      >
        <Home className="size-3.5" />
        <span className="truncate">{definitionName || "Workflow root"}</span>
      </button>
      {stack.map((frame, idx) => {
        const isLast = idx === stack.length - 1;
        return (
          <Fragment key={frame.id}>
            <ChevronRight className="text-muted-foreground/60 size-3.5 shrink-0" />
            {isLast ? (
              <span className="text-foreground truncate px-1.5 py-0.5 font-medium">
                {frame.displayName}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => popTo(idx)}
                className="text-muted-foreground hover:text-foreground truncate rounded px-1.5 py-0.5 transition-colors"
              >
                {frame.displayName}
              </button>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
