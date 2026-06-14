"use client";

import { Eye, Pencil } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  rows?: number;
  className?: string;
};

/**
 * Plain textarea with a small toolbar that flips to a `react-markdown`
 * preview. Mirrors Blazor's `MarkdownTextArea` so every description field
 * (workflow / activity / variable / input / output) renders markdown the
 * same way.
 */
export function MarkdownTextarea({
  id,
  value,
  onChange,
  readOnly = false,
  placeholder,
  rows = 4,
  className,
}: Props) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const hasContent = (value ?? "").trim().length > 0;

  return (
    <div className={["flex flex-col gap-1", className ?? ""].join(" ").trim()}>
      <div className="flex justify-end">
        <div className="bg-muted/50 inline-flex items-center gap-0.5 rounded-md border p-0.5 text-[10.5px]">
          <Button
            type="button"
            variant={mode === "edit" ? "secondary" : "ghost"}
            size="icon-xs"
            aria-pressed={mode === "edit"}
            title="Edit"
            onClick={() => setMode("edit")}
            disabled={readOnly}
          >
            <Pencil className="size-3" />
          </Button>
          <Button
            type="button"
            variant={mode === "preview" ? "secondary" : "ghost"}
            size="icon-xs"
            aria-pressed={mode === "preview"}
            title="Preview"
            onClick={() => setMode("preview")}
          >
            <Eye className="size-3" />
          </Button>
        </div>
      </div>
      {mode === "edit" ? (
        <Textarea
          id={id}
          value={value ?? ""}
          rows={rows}
          readOnly={readOnly}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-[12px]"
        />
      ) : (
        <div
          className={[
            "prose prose-sm dark:prose-invert min-h-[6rem] max-w-none overflow-auto rounded-md border bg-background p-3",
            !hasContent ? "text-muted-foreground italic" : "",
          ].join(" ")}
        >
          {hasContent ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          ) : (
            <p className="text-xs">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
