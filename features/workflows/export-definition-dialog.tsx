"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  useBulkExportDefinitions,
  useExportDefinition,
} from "@/lib/api/elsa";

type SingleProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "single";
  definitionId: string;
  defaultFilename?: string;
};

type BulkProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "bulk";
  ids: string[];
};

type Props = SingleProps | BulkProps;

export function ExportDefinitionDialog(props: Props) {
  const { open, onOpenChange, mode } = props;
  const [includeConsumers, setIncludeConsumers] = useState(false);
  const exportSingle = useExportDefinition();
  const exportBulk = useBulkExportDefinitions();
  const pending = exportSingle.isPending || exportBulk.isPending;

  const submit = async () => {
    try {
      if (mode === "single") {
        await exportSingle.mutateAsync({
          definitionId: props.definitionId,
          includeConsumingWorkflows: includeConsumers,
          filename: props.defaultFilename,
        });
      } else {
        await exportBulk.mutateAsync({
          ids: props.ids,
          includeConsumingWorkflows: includeConsumers,
        });
      }
      toast.success("Export started — your browser is downloading the file.");
      onOpenChange(false);
    } catch {
      toast.error("Export failed.");
    }
  };

  const count = mode === "bulk" ? props.ids.length : 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "single" ? "Export workflow" : `Export ${count} workflows`}
          </DialogTitle>
          <DialogDescription>
            {mode === "single"
              ? "Download this workflow as a JSON file."
              : "Download the selected workflows as a ZIP archive."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Checkbox
            id="include-consumers"
            checked={includeConsumers}
            onCheckedChange={(c) => setIncludeConsumers(c)}
          />
          <Label htmlFor="include-consumers" className="cursor-pointer">
            Include workflows that reference these
          </Label>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            Cancel
          </DialogClose>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Exporting…" : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
