"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCcw, Trash2, X } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getSignalRHubUrl } from "@/lib/api/signalr";
import { refreshApiHealth, type ApiHealthTone } from "@/lib/api/health";
import { useElsaApiHealth } from "@/hooks/use-elsa-api-health";
import {
  connectionStateLabel,
  connectionStatusTone,
  useSignalRConnectionState,
  type ConnectionTone,
} from "@/hooks/use-signalr-connection-state";
import {
  getAccessToken,
  getExpiresAt,
  subscribe as subscribeToken,
} from "@/lib/api/token-store";
import { useActiveEngineStore } from "@/lib/engines/active-engine-store";
import {
  EngineRegistryError,
  addUserEngine,
  getAllEngines,
  removeUserEngine,
  subscribeEngines,
  updateUserEngine,
} from "@/lib/engines/registry";
import { switchEngine } from "@/lib/engines/switch-engine";
import type { EngineDescriptor } from "@/lib/engines/types";

type Tone = ApiHealthTone | ConnectionTone;

const toneDotClass: Record<Tone, string> = {
  online: "bg-emerald-500",
  checking: "bg-amber-500 animate-pulse",
  connecting: "bg-amber-500 animate-pulse",
  offline: "bg-rose-500",
};

const toneBadgeVariant: Record<
  Tone,
  "default" | "secondary" | "destructive" | "outline"
> = {
  online: "default",
  checking: "secondary",
  connecting: "secondary",
  offline: "destructive",
};

function formatRelative(ts: number | null): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return new Date(ts).toLocaleString();
}

function formatExpiry(expiresAt: number | null): {
  label: string;
  tone: Tone;
  detail: string;
} {
  if (!expiresAt) {
    return {
      label: "No expiry",
      tone: "online",
      detail: "Token lifetime unknown.",
    };
  }
  const msRemaining = expiresAt - Date.now();
  if (msRemaining <= 0) {
    return {
      label: "Expired",
      tone: "offline",
      detail: `Expired at ${new Date(expiresAt).toLocaleString()}.`,
    };
  }
  const mins = Math.round(msRemaining / 60_000);
  const tone: Tone = msRemaining < 60_000 ? "checking" : "online";
  return {
    label: mins <= 1 ? "< 1 min left" : `${mins} min left`,
    tone,
    detail: `Expires ${new Date(expiresAt).toLocaleString()}.`,
  };
}

function StatusRow({
  tone,
  label,
  description,
}: {
  tone: Tone;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className={cn("size-2.5 shrink-0 rounded-full", toneDotClass[tone])}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant={toneBadgeVariant[tone]}>{label}</Badge>
        </div>
        {description ? (
          <p className="text-muted-foreground mt-1 text-xs">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-border/40 py-2 text-xs first:border-t-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground text-right break-all">
        {value}
      </span>
    </div>
  );
}

function EngineHealthDot({ engineId }: { engineId: string }) {
  const health = useElsaApiHealth(engineId);
  return (
    <span
      aria-hidden
      title={health.label}
      className={cn("size-2 shrink-0 rounded-full", toneDotClass[health.tone])}
    />
  );
}

function EngineRow({
  engine,
  isActive,
  onSelect,
  onEdit,
  onRemove,
}: {
  engine: EngineDescriptor;
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border px-3 py-2.5 transition-colors",
        isActive ? "border-sky-500/60 bg-sky-500/5" : "border-border/60",
      )}
    >
      <label className="flex items-center pt-0.5">
        <input
          type="radio"
          name="active-engine"
          checked={isActive}
          onChange={onSelect}
          className="size-4 accent-sky-500"
          aria-label={`Use ${engine.label} as active engine`}
        />
      </label>
      <EngineHealthDot engineId={engine.id} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{engine.label}</span>
          <Badge
            variant={engine.source === "env" ? "secondary" : "outline"}
            className="text-[10px] uppercase tracking-wide"
          >
            {engine.source === "env" ? "Provisioned" : "Custom"}
          </Badge>
          {!engine.serverAllowlisted ? (
            <Badge variant="destructive" className="text-[10px]">
              Not authorized
            </Badge>
          ) : null}
          {isActive ? (
            <Badge className="text-[10px]">Active</Badge>
          ) : null}
        </div>
        <div className="text-muted-foreground font-mono text-[11px] break-all">
          {engine.url}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Edit engine"
          onClick={onEdit}
          disabled={engine.source === "env"}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Remove engine"
          onClick={onRemove}
          disabled={engine.source === "env"}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function EngineFormRow({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: { label: string; url: string };
  onCancel: () => void;
  onSubmit: (values: { label: string; url: string }) => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ label, url });
      }}
      className="flex items-end gap-2 rounded-md border border-dashed border-border/80 p-3"
    >
      <div className="flex-1 space-y-1">
        <Label htmlFor="engine-label" className="text-[11px]">
          Label
        </Label>
        <Input
          id="engine-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Staging"
          autoFocus
        />
      </div>
      <div className="flex-[2] space-y-1">
        <Label htmlFor="engine-url" className="text-[11px]">
          URL
        </Label>
        <Input
          id="engine-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://elsa.example.com/elsa/api"
          inputMode="url"
        />
      </div>
      <Button type="submit" size="sm">
        {initial ? "Save" : "Add"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onCancel}
        aria-label="Cancel"
      >
        <X className="size-3.5" />
      </Button>
    </form>
  );
}

function EnginesCard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const activeEngineId = useActiveEngineStore((s) => s.activeEngineId);

  const [engines, setEngines] = useState<EngineDescriptor[]>(() =>
    getAllEngines(),
  );
  useEffect(() => subscribeEngines(setEngines), []);

  const [error, setError] = useState<string | null>(null);
  const [addingOpen, setAddingOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    if (id === activeEngineId) return;
    try {
      switchEngine(id, { router, queryClient });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Switch failed.");
    }
  };

  const handleAdd = (values: { label: string; url: string }) => {
    setError(null);
    try {
      addUserEngine(values);
      setAddingOpen(false);
    } catch (err) {
      if (err instanceof EngineRegistryError) setError(err.message);
      else setError("Could not add engine.");
    }
  };

  const handleUpdate = (id: string, values: { label: string; url: string }) => {
    setError(null);
    try {
      updateUserEngine(id, values);
      setEditingId(null);
    } catch (err) {
      if (err instanceof EngineRegistryError) setError(err.message);
      else setError("Could not update engine.");
    }
  };

  const handleRemove = (id: string) => {
    setError(null);
    try {
      removeUserEngine(id);
    } catch (err) {
      if (err instanceof EngineRegistryError) setError(err.message);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Engines</CardTitle>
          <CardDescription>
            Configured Elsa workflow servers. The sidebar switcher picks among
            these — switching wipes the workspace cache and lands on the
            dashboard.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setAddingOpen((v) => !v);
            setEditingId(null);
          }}
          aria-pressed={addingOpen}
        >
          <Plus className="size-3.5" />
          Add engine
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {error ? (
          <p
            role="alert"
            className="text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs"
          >
            {error}
          </p>
        ) : null}
        {addingOpen ? (
          <EngineFormRow
            onCancel={() => setAddingOpen(false)}
            onSubmit={handleAdd}
          />
        ) : null}
        {engines.map((e) =>
          editingId === e.id ? (
            <EngineFormRow
              key={e.id}
              initial={{ label: e.label, url: e.url }}
              onCancel={() => setEditingId(null)}
              onSubmit={(v) => handleUpdate(e.id, v)}
            />
          ) : (
            <EngineRow
              key={e.id}
              engine={e}
              isActive={e.id === activeEngineId}
              onSelect={() => handleSelect(e.id)}
              onEdit={() => {
                setEditingId(e.id);
                setAddingOpen(false);
              }}
              onRemove={() => handleRemove(e.id)}
            />
          ),
        )}
      </CardContent>
    </Card>
  );
}

export default function ConnectionSettingsPage() {
  const activeEngineId = useActiveEngineStore((s) => s.activeEngineId);
  const engines = useMemo(() => getAllEngines(), []);
  const activeEngine = engines.find((e) => e.id === activeEngineId);

  const rest = useElsaApiHealth();
  const [restRefreshing, setRestRefreshing] = useState(false);

  const signalrState = useSignalRConnectionState();
  const signalrTone = connectionStatusTone(signalrState);
  const signalrLabel = connectionStateLabel(signalrState);

  const [hasToken, setHasToken] = useState<boolean>(() => !!getAccessToken());
  const [expiresAt, setExpiresAt] = useState<number | null>(() => getExpiresAt());

  useEffect(() => {
    const unsubscribe = subscribeToken((token) => {
      setHasToken(!!token);
      setExpiresAt(getExpiresAt());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Tick periodically so the "min left" / "x ago" labels stay fresh without
  // needing a heavier ticker.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const expiry = formatExpiry(expiresAt);
  const authTone: Tone = hasToken ? expiry.tone : "offline";
  const authLabel = hasToken ? expiry.label : "Not authenticated";
  const authDetail = hasToken
    ? expiry.detail
    : "No access token is currently held in the browser.";

  const onTestNow = async () => {
    setRestRefreshing(true);
    try {
      await refreshApiHealth();
    } finally {
      setRestRefreshing(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Connection</h1>
        <p className="text-muted-foreground text-sm">
          Live status of the Elsa backend the Studio is talking to.
        </p>
      </header>

      <EnginesCard />

      <Card>
        <CardHeader>
          <CardTitle>REST API · Active engine</CardTitle>
          <CardDescription>
            The Elsa Workflow Server endpoint used for all REST calls on{" "}
            <span className="font-medium">{activeEngine?.label ?? "—"}</span>.
            The sidebar status dot mirrors this check.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <StatusRow
              tone={rest.tone}
              label={rest.label}
              description={rest.detail}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void onTestNow();
              }}
              disabled={restRefreshing}
            >
              <RefreshCcw
                className={cn("size-3.5", restRefreshing && "animate-spin")}
              />
              Test now
            </Button>
          </div>
          <div>
            <MetaRow label="Base URL" value={activeEngine?.url ?? "—"} />
            <MetaRow
              label="Latency"
              value={rest.latencyMs == null ? "—" : `${rest.latencyMs} ms`}
            />
            <MetaRow
              label="Last checked"
              value={formatRelative(rest.checkedAt)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Realtime (SignalR)</CardTitle>
          <CardDescription>
            Optional live workflow-instance updates. The Studio falls back to
            REST polling when the hub is unreachable, so this state does not
            affect the sidebar indicator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatusRow
            tone={signalrTone}
            label={signalrLabel}
            description={
              signalrTone === "online"
                ? "Hub is connected and streaming events."
                : signalrTone === "connecting"
                  ? "Studio is trying to reach the hub."
                  : "Hub is not connected — falling back to REST polling."
            }
          />
          <div>
            <MetaRow label="Hub URL" value={getSignalRHubUrl()} />
            <MetaRow label="State" value={signalrLabel} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>
            The short-lived access token held by the browser for the active
            engine.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatusRow tone={authTone} label={authLabel} description={authDetail} />
          <div>
            <MetaRow label="Token present" value={hasToken ? "Yes" : "No"} />
            <MetaRow
              label="Expires at"
              value={expiresAt ? new Date(expiresAt).toLocaleString() : "—"}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
