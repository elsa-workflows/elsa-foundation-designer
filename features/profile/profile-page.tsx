"use client";

import { formatDistanceToNow } from "date-fns";
import { LogOut, ShieldCheck, ShieldOff } from "lucide-react";
import { useEffect, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/features/instances/copy-button";
import { useLogout, useSession } from "@/features/auth/use-session";
import {
  getExpiresAt,
  subscribe as subscribeToken,
} from "@/lib/api/token-store";
import { useActiveEngineStore } from "@/lib/engines/active-engine-store";
import { getEngineById, subscribeEngines } from "@/lib/engines/registry";
import type { EngineDescriptor } from "@/lib/engines/types";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "?";
}

/**
 * Read-only profile page that surfaces the active session — the things a
 * user typically needs to share with support or verify before raising an
 * issue: who they are, what backend they're talking to, when their token
 * expires. Mutation of the profile itself isn't exposed by the Elsa server,
 * so the page intentionally doesn't pretend it can edit the account.
 */
export function ProfilePage() {
  const { session, isLoading } = useSession();
  const logout = useLogout();
  const engineId = useActiveEngineStore((s) => s.activeEngineId);

  // The engine registry can change at runtime when the user adds/removes
  // engines on the connection settings page — subscribe so the displayed
  // engine label/URL stays accurate.
  const [engine, setEngine] = useState<EngineDescriptor | null>(() =>
    getEngineById(engineId),
  );
  useEffect(() => {
    setEngine(getEngineById(engineId));
    return subscribeEngines(() => setEngine(getEngineById(engineId)));
  }, [engineId]);

  // Token expiry isn't reactive in the query cache (it lives in `token-store`),
  // so subscribe to its store and tick locally. `tick` also forces a re-render
  // every 30 s so "expires in X" stays fresh without a full refetch.
  const [expiresAt, setExpiresAt] = useState<number | null>(() =>
    getExpiresAt(engineId),
  );
  useEffect(() => {
    setExpiresAt(getExpiresAt(engineId));
    const unsub = subscribeToken(() => setExpiresAt(getExpiresAt(engineId)));
    const id = window.setInterval(() => {
      setExpiresAt(getExpiresAt(engineId));
    }, 30_000);
    return () => {
      unsub();
      window.clearInterval(id);
    };
  }, [engineId]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <Header title="Profile" subtitle="Loading account…" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <Header
          title="Profile"
          subtitle="You're not signed in. Use the Sign in button to authenticate."
        />
      </div>
    );
  }

  const name = session.user.name;
  const email = session.user.email;
  const sub = session.user.sub;
  const initials = initialsOf(name);

  const expiresMs = expiresAt;
  const isExpired = expiresMs != null && expiresMs * 1000 < Date.now();
  const expiresLabel =
    expiresMs == null
      ? "No expiry advertised"
      : isExpired
        ? "Token has expired"
        : `Expires ${formatDistanceToNow(new Date(expiresMs * 1000), { addSuffix: true })}`;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <Header
        title="Profile"
        subtitle="Your account and the session this browser holds."
      />

      <Card>
        <CardContent className="flex items-start gap-4 pt-6">
          <Avatar className="size-14 rounded-md">
            <AvatarFallback className="rounded-md bg-primary/15 text-primary text-lg font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold">{name}</h2>
              {isExpired ? (
                <Badge
                  variant="outline"
                  className="border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                >
                  <ShieldOff className="mr-1 size-3" /> Token expired
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                >
                  <ShieldCheck className="mr-1 size-3" /> Signed in
                </Badge>
              )}
            </div>
            {email ? (
              <p className="text-muted-foreground text-sm">{email}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            What the connected Elsa server knows about you. These values come
            from the identity provider that issued the current token.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <Row label="Name" value={name} />
          <Row label="Email" value={email || "—"} />
          <Row label="Subject (sub)" value={sub || "—"} mono copyable />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>
            The backend this browser is talking to and the lifetime of the
            access token used for API calls.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <Row label="Engine" value={engine?.label || engineId} />
          <Row label="URL" value={engine?.url || "—"} mono copyable />
          <Row label="Token" value={expiresLabel} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sign out</CardTitle>
          <CardDescription>
            Ends this session for the {engine?.label || engineId} engine. Other
            engines you&apos;ve signed into stay signed in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOut className="size-3.5" />
            {logout.isPending ? "Signing out…" : "Sign out"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle ? <p className="text-muted-foreground text-sm">{subtitle}</p> : null}
    </header>
  );
}

function Row({
  label,
  value,
  mono = false,
  copyable = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  return (
    <div className="group grid grid-cols-[max-content_1fr_auto] items-center gap-3">
      <p className="text-muted-foreground">{label}</p>
      <p className={mono ? "truncate font-mono text-xs" : "truncate"} title={value}>
        {value}
      </p>
      {copyable && value !== "—" ? (
        <CopyButton
          value={value}
          variant="inline"
          label={`Copy ${label.toLowerCase()}`}
          successMessage={`Copied ${label.toLowerCase()}.`}
        />
      ) : (
        <span />
      )}
    </div>
  );
}
