"use client";

import { Upload } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useImportInstanceFiles } from "@/lib/api/elsa";

/**
 * Toolbar button that uploads workflow instance JSON or ZIP files. Mirrors
 * `ImportDefinitionsButton` but targets the instance import endpoint.
 */
export function ImportInstancesButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const importFiles = useImportInstanceFiles();

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    try {
      const res = await importFiles.mutateAsync(files);
      // The server returns either `count`, `imported`, or `instanceIds`
      // depending on version; degrade gracefully.
      const count =
        res.count ??
        res.imported ??
        (Array.isArray(res.instanceIds) ? res.instanceIds.length : 0);
      toast.success(
        count === 1 ? "Imported 1 instance." : `Imported ${count} instances.`,
      );
    } catch {
      toast.error(
        "Import failed. Make sure the files are valid Elsa workflow instance JSON or ZIP.",
      );
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={importFiles.isPending}
        title="Import workflow instances from JSON or ZIP"
      >
        <Upload className="size-3.5" />
        {importFiles.isPending ? "Importing…" : "Import"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".json,.zip,application/json,application/zip"
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
    </>
  );
}
