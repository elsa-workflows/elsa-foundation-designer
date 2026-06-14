"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { ActivityDescriptor, ActivityJson } from "@/lib/api/types";

type Props = {
  activity: ActivityJson;
  descriptor: ActivityDescriptor | null;
};

/**
 * Read-only metadata panel. Mirrors `InfoTab.razor` — ID, Node ID, Type,
 * Description, Version. When the activity is a workflow-as-activity (the
 * Blazor convention is to stash the referenced workflow's id on
 * ConstructionProperties.WorkflowDefinitionId), the Type cell links to that
 * workflow's editor.
 */
export function ActivityInfoTab({ activity, descriptor }: Props) {
  const nodeId = (activity.metadata?.nodeId as string | undefined) ?? activity.id;
  const linkedDefinitionId = readLinkedWorkflowId(descriptor);

  return (
    <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-xs">
      <Row label="ID" value={<span className="font-mono break-all">{activity.id}</span>} />
      <Row label="Node ID" value={<span className="font-mono break-all">{nodeId}</span>} />
      <Row
        label="Type"
        value={
          linkedDefinitionId ? (
            <Link
              href={`/workflows/definitions/${linkedDefinitionId}/edit`}
              className="text-primary hover:underline inline-flex items-center gap-1 break-all font-mono"
            >
              {activity.type}
              <ExternalLink className="size-3 shrink-0" />
            </Link>
          ) : (
            <span className="font-mono break-all">{activity.type}</span>
          )
        }
      />
      {descriptor ? (
        <>
          <Row label="Display" value={descriptor.displayName ?? descriptor.name} />
          <Row label="Category" value={descriptor.category} />
          <Row label="Kind" value={descriptor.kind} />
          <Row label="Version" value={String(descriptor.version)} />
          {descriptor.description ? (
            <Row label="Description" value={descriptor.description} />
          ) : null}
        </>
      ) : (
        <Row label="Descriptor" value="Unknown" />
      )}
    </dl>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </>
  );
}

function readLinkedWorkflowId(descriptor: ActivityDescriptor | null): string | null {
  if (!descriptor) return null;
  const props = (descriptor.constructionProperties ?? descriptor.customProperties ?? {}) as Record<
    string,
    unknown
  >;
  const candidate =
    (props.WorkflowDefinitionId as string | undefined) ??
    (props.workflowDefinitionId as string | undefined);
  return candidate && typeof candidate === "string" ? candidate : null;
}
