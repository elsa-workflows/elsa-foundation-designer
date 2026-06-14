"use client";

import { HubConnectionState } from "@microsoft/signalr";
import { useEffect, useState } from "react";

import {
  getSignalRConnectionState,
  subscribeToConnectionState,
} from "@/lib/api/signalr";

export type ConnectionTone = "online" | "connecting" | "offline";

export function connectionStatusTone(state: HubConnectionState): ConnectionTone {
  switch (state) {
    case HubConnectionState.Connected:
      return "online";
    case HubConnectionState.Connecting:
    case HubConnectionState.Reconnecting:
      return "connecting";
    case HubConnectionState.Disconnected:
    case HubConnectionState.Disconnecting:
    default:
      return "offline";
  }
}

export function connectionStateLabel(state: HubConnectionState): string {
  switch (state) {
    case HubConnectionState.Connected:
      return "Connected";
    case HubConnectionState.Connecting:
      return "Connecting…";
    case HubConnectionState.Reconnecting:
      return "Reconnecting…";
    case HubConnectionState.Disconnecting:
      return "Disconnecting…";
    case HubConnectionState.Disconnected:
    default:
      return "Disconnected";
  }
}

/**
 * Subscribe to the shared SignalR hub and re-render whenever its state
 * changes. The first call from anywhere in the app triggers the underlying
 * hub `start()`, so simply mounting this hook anchors the connection lifecycle.
 */
export function useSignalRConnectionState(): HubConnectionState {
  const [state, setState] = useState<HubConnectionState>(() =>
    getSignalRConnectionState(),
  );

  useEffect(() => {
    return subscribeToConnectionState(setState);
  }, []);

  return state;
}
