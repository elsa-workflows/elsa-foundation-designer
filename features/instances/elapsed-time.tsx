"use client";

import { useEffect, useState } from "react";

type Props = {
  /** Workflow instance start timestamp (ISO string). */
  startedAt: string;
  /** Finish timestamp (ISO string) — when set, the counter freezes here. */
  finishedAt?: string | null;
  /** Whether to keep ticking. When false, renders the frozen duration. */
  isRunning: boolean;
};

/**
 * Mirrors Blazor's `<ElapsedTime>`: while the instance is running, ticks every
 * second so users can see how long it has been executing; once finished, shows
 * the final duration computed from `finishedAt - startedAt`.
 */
export function ElapsedTime({ startedAt, finishedAt, isRunning }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  const startMs = new Date(startedAt).getTime();
  const endMs = isRunning
    ? now
    : finishedAt
      ? new Date(finishedAt).getTime()
      : now;
  const elapsedMs = Math.max(0, endMs - startMs);
  return <span className="font-mono tabular-nums">{formatDuration(elapsedMs)}</span>;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = minutes.toString().padStart(2, "0");
  const ss = seconds.toString().padStart(2, "0");
  if (hours > 0) return `${hours}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}
