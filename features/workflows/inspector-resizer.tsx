"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useEditorStore } from "@/features/workflows/editor-store";

/**
 * Vertical drag handle that sits on the left edge of the activity inspector
 * and lets the user resize it on the fly. Width is persisted to the editor
 * store and bounded to `[280, viewport-200]` px so the canvas can't be
 * squeezed out of existence.
 *
 * - Drag → resize as you go.
 * - Double-click → snap back to the default 420 px.
 */
export function InspectorResizer() {
  const inspectorWidth = useEditorStore((s) => s.inspectorWidth);
  const setInspectorWidth = useEditorStore((s) => s.setInspectorWidth);
  const inspectorFocus = useEditorStore((s) => s.inspectorFocus);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(inspectorWidth);

  const onDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (inspectorFocus) return; // resize disabled in focus mode
      e.preventDefault();
      (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
      startXRef.current = e.clientX;
      startWidthRef.current = inspectorWidth;
      setDragging(true);
    },
    [inspectorWidth, inspectorFocus],
  );

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      const dx = e.clientX - startXRef.current;
      // Dragging left widens the panel (panel sits on the right edge).
      const next = startWidthRef.current - dx;
      const max = Math.max(320, window.innerWidth - 200);
      setInspectorWidth(Math.min(max, Math.max(280, next)));
    },
    [dragging, setInspectorWidth],
  );

  const onUp = useCallback(() => {
    setDragging(false);
  }, []);

  // Reset cursor outside the handle while dragging so the page doesn't flicker.
  useEffect(() => {
    if (!dragging) return;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragging]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize inspector"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onDoubleClick={() => setInspectorWidth(420)}
      className={[
        "group/handle absolute -left-1 top-0 z-20 flex h-full w-2 cursor-ew-resize items-center justify-center",
        inspectorFocus ? "pointer-events-none opacity-0" : "",
      ].join(" ")}
    >
      <div
        className={[
          "h-12 w-0.5 rounded-full transition-colors duration-100",
          dragging
            ? "bg-sky-500"
            : "bg-border group-hover/handle:bg-sky-500/70",
        ].join(" ")}
      />
    </div>
  );
}
