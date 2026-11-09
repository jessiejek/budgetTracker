import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import {
  acknowledged,
  cache,
  cached,
  persist,
  pending,
  remove,
} from "./offline";
import { emptyData, type Data, type Row, type Table } from "./types";
export function useLedger(user: string | undefined) {
  const [data, setData] = useState<Data>(emptyData),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [queued, setQueued] = useState(0),
    [online, setOnline] = useState(navigator.onLine);
  const current = useRef(user);
  current.current = user;
  const busy = useRef(false);
  const refresh = useCallback(async () => {
    if (!user || !supabase || busy.current) return;
    busy.current = true;
    try {
      const queue = await pending(user);
      if (current.current === user) setQueued(queue.length);
      if (!navigator.onLine) return;
      for (const item of queue) {
        if (current.current !== user) return;
        if (item.op === "delete") {
          const { error } = await supabase
            .from(item.table)
            .delete()
            .eq("id", item.row.id)
            .eq("user_id", user);
          if (error) throw error;
        } else {
          const payload: Record<string, unknown> = { ...item.row };
          const { error } = await supabase.from(item.table).upsert(payload);
          if (error) throw error;
        }
        await acknowledged(item.id);
      }
      if (current.current !== user) return;
      setQueued((await pending(user)).length);
      const tables: Table[] = [
        "categories",
        "wallets",
        "transactions",
        "budgets",
      ];
      // Paginate to avoid Supabase's default row cap silently hiding old expenses.
      const results = await Promise.all(
        tables.map(async (table) => {
          const rows: Row[] = [];
          for (let from = 0; ; from += 500) {
            if (current.current !== user) throw new Error("Account changed.");
            const result = await supabase!
              .from(table)
              .select("*")
              .eq("user_id", user)
              .order("id")
              .range(from, from + 499);
            if (result.error) throw result.error;
            rows.push(...(result.data as Row[]));
            if (result.data.length < 500) break;
          }
          return rows;
        }),
      );
      const remote = Object.fromEntries(
        tables.map((t, i) => [t, results[i]]),
      ) as unknown as Data;
      const fresh = await cache(user, remote);
      if (current.current === user) {
        setData(fresh);
        setError("");
        setQueued((await pending(user)).length);
      }
    } catch (e) {
      if (current.current === user)
        setError(
          e && typeof e === "object" && "message" in e
            ? String(e.message)
            : "Sync failed. Your offline changes are kept; retry when ready.",
        );
    } finally {
      busy.current = false;
      if (current.current === user) setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    let active = true;
    setData(emptyData());
    setLoading(true);
    setError("");
    setQueued(0);
    if (!user) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const saved = await cached(user);
        if (active && saved) setData(saved);
        if (active) await refresh();
      } catch {
        if (active) setError("Offline storage is unavailable in this browser.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    const reconnect = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void refresh();
    };
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", reconnect);
    const timer = window.setInterval(() => {
      void refresh();
    }, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("online", reconnect);
      window.removeEventListener("offline", reconnect);
    };
  }, [user, refresh]);
  async function save(
    table: Table,
    row: Row,
    options?: { clientCreate?: boolean },
  ) {
    if (!user || row.user_id !== user) throw new Error("Please sign in again.");
    const mutation = {
      id: crypto.randomUUID(),
      table,
      row,
      clientCreate: options?.clientCreate,
    };
    const previous = await persist(user, mutation);
    if (current.current === user) {
      setData(previous);
      setQueued((await pending(user)).length);
    }
    void refresh();
  }
  async function removeRow(table: Table, row: Row) {
    if (!user || row.user_id !== user) throw new Error("Please sign in again.");
    const previous = await remove(user, table, row);
    if (current.current === user) {
      setData(previous);
      setQueued((await pending(user)).length);
    }
    void refresh();
  }
  return {
    data,
    loading,
    error,
    queued,
    online,
    save,
    remove: removeRow,
    refresh,
  };
}
