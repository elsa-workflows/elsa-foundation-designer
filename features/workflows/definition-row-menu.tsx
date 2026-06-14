"use client";

import {
  Ban,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  MoreHorizontal,
  Play,
  Trash2,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WorkflowDefinitionSummary } from "@/lib/api/types";

type Action =
  | "open"
  | "duplicate"
  | "export"
  | "run"
  | "cancel-instances"
  | "publish"
  | "retract"
  | "delete";

type Props = {
  definition: WorkflowDefinitionSummary;
  onAction: (action: Action, definition: WorkflowDefinitionSummary) => void;
};

export function DefinitionRowMenu({ definition, onAction }: Props) {
  const router = useRouter();
  const open = (e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    router.push(`/workflows/definitions/${definition.definitionId}/edit`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Actions"
            onClick={(e) => e.stopPropagation()}
          />
        }
      >
        <MoreHorizontal className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => open()}>
          <ExternalLink className="size-3.5" /> Open in designer
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("duplicate", definition)}>
          <Copy className="size-3.5" /> Duplicate…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("export", definition)}>
          <Download className="size-3.5" /> Export…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("run", definition)}>
          <Play className="size-3.5" /> Run
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("cancel-instances", definition)}>
          <Ban className="size-3.5" /> Cancel running instances
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {definition.isPublished ? (
          <DropdownMenuItem onClick={() => onAction("retract", definition)}>
            <XCircle className="size-3.5" /> Unpublish
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onAction("publish", definition)}>
            <CheckCircle2 className="size-3.5" /> Publish
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onAction("delete", definition)}
        >
          <Trash2 className="size-3.5" /> Delete…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type { Action as DefinitionRowAction };
