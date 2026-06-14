"use client";

import { Upload } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useImportFiles } from "@/lib/api/elsa";

/**
 * A toolbar button that opens a file picker (JSON / ZIP) and pushes the files
 * through the import endpoint. Showing per-file results is deferred — the API
 * just returns a count.
 */
export function ImportDefinitionsButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const importFiles = useImportFiles();

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    try {
      const res = await importFiles.mutateAsync(files);
      toast.success(
        res.count === 1 ? "Imported 1 workflow." : `Imported ${res.count} workflows.`,
      );
    } catch {
      toast.error("Import failed. Make sure the files are valid Elsa workflow JSON or ZIP.");
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
