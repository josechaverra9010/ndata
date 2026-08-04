import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/config/api";

const QUEUE_KEY = "nutridata-offline-queue";

export interface OfflineQueueItem {
  client_id: string;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
}

function readQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: OfflineQueueItem[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export function useOfflineQueue(patientId?: number) {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setPending(readQueue().length);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const enqueue = useCallback((action: string, payload: Record<string, unknown>) => {
    const item: OfflineQueueItem = {
      client_id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      action,
      payload,
      created_at: new Date().toISOString(),
    };
    const next = [...readQueue(), item];
    writeQueue(next);
    setPending(next.length);
    return item.client_id;
  }, []);

  const sync = useCallback(async () => {
    if (!patientId || !navigator.onLine) return { synced: 0 };
    const queue = readQueue();
    if (!queue.length) return { synced: 0 };

    setSyncing(true);
    try {
      const token = localStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/patient/${patientId}/offline/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ items: queue }),
      });
      if (!res.ok) throw new Error("Sync failed");
      const data = await res.json();
      const failed = new Set(
        (data.results || [])
          .filter((r: { status: string }) => r.status === "error")
          .map((r: { client_id: string }) => r.client_id)
      );
      const remaining = queue.filter((i) => failed.has(i.client_id));
      writeQueue(remaining);
      setPending(remaining.length);
      return data;
    } finally {
      setSyncing(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (online && patientId && pending > 0) {
      sync();
    }
  }, [online, patientId, pending, sync]);

  return { online, pending, syncing, enqueue, sync };
}
