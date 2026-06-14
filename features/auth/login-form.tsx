"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2, LogIn } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLogin } from "@/features/auth/use-session";
import { getActiveEngineId } from "@/lib/engines/active-engine-store";
import {
  getAllEngines,
  subscribeEngines,
} from "@/lib/engines/registry";
import type { EngineDescriptor } from "@/lib/engines/types";

const schema = z.object({
  username: z.string().min(1, "Enter your username"),
  password: z.string().min(1, "Enter your password"),
});

type Values = z.infer<typeof schema>;

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const queryEngineId = params.get("engineId");
  const login = useLogin();

  // Start with an empty list so SSR and the first client render agree. We
  // populate from the registry once mounted — user-added engines live in
  // localStorage and don't exist on the server, so hydrating with the full
  // list immediately would cause a mismatch.
  const [engines, setEngines] = useState<EngineDescriptor[]>([]);
  useEffect(() => subscribeEngines(setEngines), []);

  const authenticatableEngines = useMemo(
    () => engines.filter((e) => e.serverAllowlisted),
    [engines],
  );

  const [engineId, setEngineId] = useState<string>(() => {
    if (queryEngineId && engines.some((e) => e.id === queryEngineId)) {
      return queryEngineId;
    }
    const active = getActiveEngineId();
    if (engines.some((e) => e.id === active && e.serverAllowlisted)) {
      return active;
    }
    return authenticatableEngines[0]?.id ?? active;
  });

  const [rememberMe, setRememberMe] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: standardSchemaResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = handleSubmit((values) => {
    login.mutate(
      { ...values, engineId, rememberMe, next },
      {
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Login failed"),
      },
    );
  });

  const showEnginePicker = engines.length > 1;
  const selectedEngine = engines.find((e) => e.id === engineId);
  const blockedByAllowlist =
    !!selectedEngine && !selectedEngine.serverAllowlisted;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="space-y-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-background">
            <Image
              src="/elsa-logo.png"
              alt="Elsa"
              width={40}
              height={40}
              priority
              className="size-9 object-contain"
            />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl">Sign in to Elsa Studio</CardTitle>
            <CardDescription>
              Use your Elsa Identity credentials to access the workflow control
              plane.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            {showEnginePicker ? (
              <div className="space-y-1.5">
                <Label htmlFor="engine">Engine</Label>
                <Select
                  value={engineId}
                  onValueChange={(v) => {
                    if (v) setEngineId(v);
                  }}
                >
                  <SelectTrigger id="engine" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {engines.map((e) => (
                      <SelectItem
                        key={e.id}
                        value={e.id}
                        disabled={!e.serverAllowlisted}
                      >
                        <span className="flex flex-col">
                          <span>{e.label}</span>
                          <span className="text-muted-foreground font-mono text-[10px]">
                            {e.url}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {blockedByAllowlist ? (
                  <p className="text-destructive text-xs">
                    This engine is not allowlisted on the server. Ask an admin to
                    add it to <code>ELSA_ENGINES</code>.
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                autoFocus
                placeholder="admin"
                aria-invalid={!!errors.username}
                {...register("username")}
              />
              {errors.username ? (
                <p className="text-destructive text-xs">{errors.username.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              {errors.password ? (
                <p className="text-destructive text-xs">{errors.password.message}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={(v) => setRememberMe(v === true)}
              />
              <Label
                htmlFor="remember-me"
                className="cursor-pointer text-sm font-normal"
              >
                Remember me
              </Label>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={login.isPending || blockedByAllowlist}
            >
              {login.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogIn className="size-4" />
              )}
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
