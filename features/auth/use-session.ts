"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { setAccessToken } from "@/lib/api/token-store";
import {
  getActiveEngineId,
  useActiveEngineStore,
} from "@/lib/engines/active-engine-store";

type MeResponseAuthenticated = {
  authenticated: true;
  engineId: string;
  accessToken: string;
  expiresAt: number | null;
  user: { name: string; email: string | null; sub: string | null };
};

type MeResponse = MeResponseAuthenticated | { authenticated: false };

function meQueryKey(engineId: string) {
  return ["auth", "me", engineId] as const;
}

async function fetchMe(engineId: string): Promise<MeResponse> {
  const res = await fetch(
    `/api/auth/me?engineId=${encodeURIComponent(engineId)}`,
    { credentials: "include", cache: "no-store" },
  );
  if (res.status === 401) return { authenticated: false };
  if (!res.ok) throw new Error(`me failed: ${res.status}`);
  return (await res.json()) as MeResponse;
}

export function useSession() {
  const engineId = useActiveEngineStore((s) => s.activeEngineId);
  const query = useQuery({
    queryKey: meQueryKey(engineId),
    queryFn: () => fetchMe(engineId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const session = query.data?.authenticated ? query.data : null;

  useEffect(() => {
    if (session) {
      setAccessToken(
        session.engineId,
        session.accessToken,
        session.expiresAt ?? null,
      );
    } else if (query.isFetched) {
      setAccessToken(engineId, null);
    }
  }, [session, query.isFetched, engineId]);

  return { session, isLoading: query.isPending, refetch: query.refetch };
}

export function useLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async (creds: {
      username: string;
      password: string;
      engineId?: string;
      rememberMe?: boolean;
      next?: string;
    }) => {
      const engineId = creds.engineId ?? getActiveEngineId();
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: creds.username,
          password: creds.password,
          engineId,
          rememberMe: creds.rememberMe ?? true,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Login failed (${res.status})`);
      }
      const body = (await res.json()) as { engineId: string };
      return { next: creds.next ?? "/dashboard", engineId: body.engineId };
    },
    onSuccess: async ({ next, engineId }) => {
      // The login response is the source of truth for which engine the
      // session belongs to — sync the active-engine store before the next
      // /me runs.
      useActiveEngineStore.getState().setActiveEngine(engineId);
      // Wipe the entire React Query cache. A successful login is always
      // a hard context switch (different user, different engine, or both),
      // and any cached data is bound to belong to the previous context.
      // Without this, the dashboard would render stale data from the old
      // engine until each query's staleTime expired.
      queryClient.clear();
      router.push(next);
      router.refresh();
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async () => {
      const engineId = getActiveEngineId();
      await fetch(
        `/api/auth/logout?engineId=${encodeURIComponent(engineId)}`,
        { method: "POST", credentials: "include" },
      );
      return { engineId };
    },
    onSuccess: async ({ engineId }) => {
      setAccessToken(engineId, null);
      queryClient.setQueryData(meQueryKey(engineId), { authenticated: false });
      router.push("/login");
      router.refresh();
    },
  });
}
