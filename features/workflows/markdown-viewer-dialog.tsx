"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Subtitle/byline shown under the title in the dialog header. */
  subtitle?: string;
  /** Markdown body. Plain text falls through unstyled. */
  content: string | null | undefined;
};

/**
 * Read-only markdown viewer used for long workflow descriptions. Mirrors the
 * Blazor `WorkflowDefinitionList` "View description" modal.
 */
export function MarkdownViewerDialog({
  open,
  onOpenChange,
  title = "Description",
  subtitle,
  content,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
        </DialogHeader>
        <div className="prose prose-sm dark:prose-invert max-h-[60vh] max-w-none overflow-auto">
          {content && content.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          ) : (
            <p className="text-muted-foreground text-sm italic">No description.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
