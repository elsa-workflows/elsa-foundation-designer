"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useEditorStore,
  type PropertiesSubTab,
} from "@/features/workflows/editor-store";
import { InfoTab } from "@/features/workflows/workflow-properties/info-tab";
import { InputsOutputsTab } from "@/features/workflows/workflow-properties/inputs-outputs-tab";
import { VariablesTab } from "@/features/workflows/workflow-properties/variables-tab";
import { VersionHistoryTab } from "@/features/workflows/workflow-properties/version-history-tab";

/**
 * Center "Properties" tab — workflow-scoped settings, not activity-scoped.
 *
 * The active sub-tab lives in the editor store so other surfaces can deep-link
 * into Variables / Inputs / Outputs (e.g. the activity-card bindings popover
 * jumps here when the user clicks a referenced name).
 */
export function WorkflowPropertiesPanel() {
  const value = useEditorStore((s) => s.propertiesSubTab);
  const setValue = useEditorStore((s) => s.setPropertiesSubTab);
  return (
    <Tabs
      value={value}
      onValueChange={(v) => setValue(v as PropertiesSubTab)}
      className="flex h-full min-h-0 flex-1 flex-col"
    >
      <div className="border-b px-3 py-1.5">
        <TabsList variant="line">
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="variables">Variables</TabsTrigger>
          <TabsTrigger value="io">Inputs / Outputs</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
        </TabsList>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <TabsContent value="info" className="p-4">
          <InfoTab />
        </TabsContent>
        <TabsContent value="variables" className="p-4">
          <VariablesTab />
        </TabsContent>
        <TabsContent value="io" className="p-4">
          <InputsOutputsTab />
        </TabsContent>
        <TabsContent value="versions" className="p-4">
          <VersionHistoryTab />
        </TabsContent>
      </div>
    </Tabs>
  );
}
