"use client";

import { AlertCircle, Check, Minimize2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MonacoCodeEditor,
  type MonacoLanguage,
} from "@/features/workflows/activity-properties/monaco-editor";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Field label shown in the dialog title (e.g. "Code", "Body", "Condition"). */
  title: string;
  /** Optional helper line under the title. */
  subtitle?: string;
  /** Pre-existing value when the dialog opens — the dialog edits a local
   *  buffer and only commits on Save so the user can cancel out cleanly. */
  initialValue: string;
  language: MonacoLanguage;
  readOnly?: boolean;
  /** Final value when the user presses Save / closes via Done. */
  onSave: (next: string) => void;
};

/**
 * Fullscreen-ish editor for code-like inputs. Same Monaco language as the
 * inline panel editor; opens to ~80vw × 80vh so the user has real estate
 * to write long expressions, JSON payloads or scripts.
 *
 * Edits happen on a local buffer; nothing's persisted until the user clicks
 * **Save** (or hits ⌘/Ctrl + Enter). Closing without saving keeps the
 * original value — same convention as VS Code's "Edit in editor" modals.
 */
export function CodeEditorDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  initialValue,
  language,
  readOnly = false,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(initialValue);
  // Snapshot of the value at the moment the dialog opened; used to detect
  // whether the user changed anything before saving. Updated whenever `open`
  // transitions to true so re-opens see the fresh underlying value.
  const [startedAt, setStartedAt] = useState(initialValue);

  useEffect(() => {
    if (open) {
      setDraft(initialValue);
      setStartedAt(initialValue);
    }
  }, [open, initialValue]);

  // JSON inline validation — Monaco shows it in the gutter, we mirror it in
  // the footer so the Save button can disable on a syntax error.
  const parseError = (() => {
    if (language !== "json") return null;
    if (!draft.trim()) return null;
    try {
      JSON.parse(draft);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Invalid JSON";
    }
  })();

  const dirty = draft !== startedAt;

  const commit = () => {
    if (parseError) return;
    if (dirty) onSave(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[min(1100px,90vw)] !w-[min(1100px,90vw)] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-sm">{title}</DialogTitle>
            <Badge variant="outline" className="font-mono text-2xs font-normal lowercase">
              {language}
            </Badge>
            {readOnly ? (
              <Badge variant="outline" className="text-2xs font-normal">
                read-only
              </Badge>
            ) : null}
            {dirty ? (
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-amber-500"
                title="Unsaved changes"
              />
            ) : null}
          </div>
          {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
        </DialogHeader>

        <div
          className="bg-card overflow-hidden"
          onKeyDown={(e) => {
            // ⌘/Ctrl + Enter saves & closes.
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        >
          <MonacoCodeEditor
            value={draft}
            language={language}
            readOnly={readOnly}
            height="65vh"
            onChange={(v) => setDraft(v)}
          />
        </div>

        <DialogFooter className="flex items-center !justify-between border-t bg-muted/40 px-4 py-2">
          <div className="text-muted-foreground inline-flex items-center gap-2 text-xs">
            {parseError ? (
              <>
                <AlertCircle className="text-destructive size-3.5" />
                <span className="text-destructive max-w-[60ch] truncate">{parseError}</span>
              </>
            ) : (
              <span>
                <kbd className="bg-background rounded border px-1 py-px font-mono text-2xs">
                  ⌘
                </kbd>{" "}
                +{" "}
                <kbd className="bg-background rounded border px-1 py-px font-mono text-2xs">
                  Enter
                </kbd>{" "}
                to save
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              <Minimize2 className="size-3.5" />
              Cancel
            </Button>
            <Button size="sm" onClick={commit} disabled={!!parseError || readOnly} type="button">
              <Check className="size-3.5" />
              {dirty ? "Save" : "Done"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
