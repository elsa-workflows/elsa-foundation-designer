"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Props = {
  /**
   * Value to write to the clipboard. When a function, it's invoked at click
   * time — useful when the source object is expensive to stringify or hasn't
   * been computed yet (lazy evaluation).
   */
  value: string | (() => string);
  /** Accessible label + tooltip. Defaults to "Copy". */
  label?: string;
  /** Toast message on success. Defaults to "Copied to clipboard." */
  successMessage?: string;
  /** Visual variant. `inline` is smaller, used inside dense rows. */
  variant?: "default" | "inline";
};

/**
 * Small icon button that writes `value` to the clipboard and shows a brief
 * "copied" confirmation. Used across the instance viewer so users can pull
 * activity ids, JSON blobs, stack traces, etc. out of the UI without manual
 * selection.
 */
export function CopyButton({
  value,
  label = "Copy",
  successMessage = "Copied to clipboard.",
  variant = "default",
}: Props) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    const text = typeof value === "function" ? value() : value;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(successMessage);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard API can be blocked by permissions / iframe embedding.
      toast.error("Couldn't access the clipboard.");
    }
  };

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={onClick}
        title={copied ? "Copied" : label}
        aria-label={label}
        className="text-muted-foreground hover:text-foreground inline-flex size-5 items-center justify-center rounded transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      >
        {copied ? (
          <Check className="size-3 text-emerald-500" />
        ) : (
          <Copy className="size-3" />
        )}
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      title={copied ? "Copied" : label}
      aria-label={label}
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-500" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </Button>
  );
}
