"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateVariableDialog } from "@/features/workflows/create-variable-dialog";
import { useEditorStore } from "@/features/workflows/editor-store";
import { friendlyTypeLabel } from "@/features/workflows/workflow-properties/type-display";
import { useVariablesScope } from "@/features/workflows/workflow-properties/variables-scope";
import { useStorageDrivers, useVariableTypes } from "@/lib/api/elsa";
import type { VariableDefinition } from "@/lib/api/types";

export function VariablesTab() {
  const definition = useEditorStore((s) => s.definition);
  const scopeBundle = useVariablesScope();
  const drivers = useStorageDrivers();
  const types = useVariableTypes();
  const [showCreate, setShowCreate] = useState(false);

  const typeItems = useMemo(
    () =>
      (types.data ?? []).map((t) => ({
        label: friendlyTypeLabel(t.displayName, t.typeName),
        value: t.typeName,
      })),
    [types.data],
  );
  const driverItems = useMemo(
    () =>
      (drivers.data ?? []).map((d) => ({
        label: friendlyTypeLabel(d.displayName, d.typeName).replace(/StorageDriver$/, ""),
        value: d.typeName,
      })),
    [drivers.data],
  );

  if (!definition || !scopeBundle) return null;

  const { scope, variables, setVariables } = scopeBundle;
  const readOnly = !!definition.isReadonly;

  const update = (id: string, patch: Partial<VariableDefinition>) =>
    setVariables(variables.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const remove = (id: string) =>
    setVariables(variables.filter((v) => v.id !== id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold">Variables</h2>
          <span className="text-muted-foreground text-xs">
            Scope: <span className="font-medium">{scope.label}</span>
          </span>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} disabled={readOnly}>
          <Plus className="size-3.5" /> Add variable
        </Button>
      </div>

      <CreateVariableDialog open={showCreate} onOpenChange={setShowCreate} />

      {variables.length === 0 ? (
        <p className="text-muted-foreground text-xs">No variables.</p>
      ) : (
        <div className="bg-card overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {variables.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <Input
                      value={v.name}
                      onChange={(e) => update(v.id, { name: e.target.value })}
                      readOnly={readOnly}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      items={typeItems}
                      value={v.typeName}
                      onValueChange={(t) => t && update(v.id, { typeName: t })}
                      disabled={readOnly}
                    >
                      <SelectTrigger size="sm" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(types.data ?? []).map((t) => (
                          <SelectItem key={t.typeName} value={t.typeName}>
                            {friendlyTypeLabel(t.displayName, t.typeName)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={v.value ?? ""}
                      onChange={(e) =>
                        update(v.id, { value: e.target.value === "" ? null : e.target.value })
                      }
                      placeholder="(empty)"
                      readOnly={readOnly}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      items={driverItems}
                      value={v.storageDriverTypeName ?? ""}
                      onValueChange={(d) =>
                        update(v.id, { storageDriverTypeName: d || null })
                      }
                      disabled={readOnly}
                    >
                      <SelectTrigger size="sm" className="w-full">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {(drivers.data ?? []).map((d) => (
                          <SelectItem key={d.typeName} value={d.typeName}>
                            {friendlyTypeLabel(d.displayName, d.typeName).replace(/StorageDriver$/, "")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${v.name}`}
                      onClick={() => remove(v.id)}
                      disabled={readOnly}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
