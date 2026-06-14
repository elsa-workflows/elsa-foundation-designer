"use client";

import { Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describeApiError } from "@/lib/api/errors";
import { useImportFiles } from "@/lib/api/elsa";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fires after a successful import so callers can refetch. */
  onImported?: (count: number) => void;
};

/**
 * Lifts the Blazor designer's Import action into the new editor. Accepts one
 * or many JSON workflow exports, posts them as multipart `files` to the Elsa
 * `workflow-definitions/import-files` endpoint via {@link useImportFiles}, and
 * reports the response count. The cache invalidation done by `useImportFiles`
 * refetches workflow lists; the parent should additionally refetch the
 * currently-open definition if it could have been overwritten.
 */
export function ImportDefinitionDialog({ open, onOpenChange, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const importer = useImportFiles();

  const reset = () => {
    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onSubmit = async () => {
    if (files.length === 0) return;
    try {
      const res = await importer.mutateAsync(files);
      toast.success(
        res.count === 1
          ? "Imported 1 workflow."
          : `Imported ${res.count} workflows.`,
      );
      reset();
      onOpenChange(false);
      onImported?.(res.count);
    } catch (err) {
      toast.error(`Import failed: ${await describeApiError(err)}`);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-4" />
            Import workflow
          </DialogTitle>
          <DialogDescription>
            Select one or more workflow JSON files. Workflows that match an
            existing definition id are overwritten.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="import-files">Files</Label>
          <Input
            id="import-files"
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          {files.length > 0 ? (
            <ul className="text-muted-foreground max-h-32 overflow-y-auto text-xs">
              {files.map((f) => (
                <li key={f.name} className="truncate">
                  {f.name}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importer.isPending}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={files.length === 0 || importer.isPending}>
            {importer.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
