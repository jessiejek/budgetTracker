import { openDB } from "idb";
import type { Data, Mutation, Row, Table } from "./types";
const db = () =>
  openDB("saldo-offline-v1", 1, {
    upgrade(db) {
      db.createObjectStore("snapshots");
      db.createObjectStore("outbox", { keyPath: "id" });
    },
  });
function normalize(data: Data) {
  data.transactions.sort(
    (a, b) =>
      b.occurred_on.localeCompare(a.occurred_on) ||
      b.created_at.localeCompare(a.created_at) ||
      b.id.localeCompare(a.id),
  );
  return data;
}
function apply(data: Data, mutation: Mutation) {
  const rows = data[mutation.table] as Row[];
  const i = rows.findIndex((row) => row.id === mutation.row.id);
  if (mutation.op === "delete") {
    if (i >= 0) rows.splice(i, 1);
    return;
  }
  if (i < 0) rows.push(mutation.row);
  else rows[i] = mutation.row;
}
export async function cached(user: string): Promise<Data | undefined> {
  const saved = await (await db()).get("snapshots", user);
  return saved ? normalize(saved) : undefined;
}
export async function cache(user: string, data: Data): Promise<Data> {
  const tx = (await db()).transaction(["snapshots", "outbox"], "readwrite");
  const queued = (await tx.objectStore("outbox").getAll())
    .filter((x) => x.owner === user)
    .sort((a, b) => a.enqueued_at - b.enqueued_at);
  for (const item of queued) apply(data, item);
  normalize(data);
  await tx.objectStore("snapshots").put(data, user);
  await tx.done;
  return data;
}
// Queue + optimistic snapshot commit atomically; a failed disk write saves neither.
export async function persist(user: string, mutation: Mutation): Promise<Data> {
  const tx = (await db()).transaction(["snapshots", "outbox"], "readwrite");
  const data: Data = (await tx.objectStore("snapshots").get(user)) ?? {
    categories: [],
    wallets: [],
    transactions: [],
    budgets: [],
  };
  const queue = await tx.objectStore("outbox").getAll();
  const order = queue.reduce(
    (last, x) => Math.max(last, x.enqueued_at + 1),
    Date.now(),
  );
  await tx
    .objectStore("outbox")
    .put({ ...mutation, owner: user, enqueued_at: order });
  apply(data, mutation);
  normalize(data);
  await tx.objectStore("snapshots").put(data, user);
  await tx.done;
  return data;
}
/** Remove a row locally. Cancels pending upserts for the same id. Queues a remote
 *  delete only when the row may already exist on the server. */
export async function remove(
  user: string,
  table: Table,
  row: Row,
): Promise<Data> {
  const tx = (await db()).transaction(["snapshots", "outbox"], "readwrite");
  const outbox = tx.objectStore("outbox");
  const snapshots = tx.objectStore("snapshots");
  const data: Data = (await snapshots.get(user)) ?? {
    categories: [],
    wallets: [],
    transactions: [],
    budgets: [],
  };
  const queue = await outbox.getAll();
  const related = queue.filter(
    (item) =>
      item.owner === user && item.table === table && item.row.id === row.id,
  );
  for (const item of related) await outbox.delete(item.id);

  const pendingCreates = related.filter(
    (item) => (item.op ?? "upsert") === "upsert" && item.clientCreate,
  );
  const pendingOtherUpserts = related.filter(
    (item) => (item.op ?? "upsert") === "upsert" && !item.clientCreate,
  );
  // Never-synced local create: drop outbox + snapshot row, no remote delete.
  const localOnly =
    pendingCreates.length > 0 &&
    pendingOtherUpserts.length === 0 &&
    !related.some((item) => item.op === "delete");

  const deletion: Mutation = {
    id: crypto.randomUUID(),
    table,
    row,
    op: "delete",
  };
  apply(data, deletion);
  normalize(data);

  if (!localOnly) {
    const order = queue
      .filter((item) => !related.some((r) => r.id === item.id))
      .reduce((last, x) => Math.max(last, x.enqueued_at + 1), Date.now());
    await outbox.put({
      ...deletion,
      owner: user,
      enqueued_at: order,
    });
  }

  await snapshots.put(data, user);
  await tx.done;
  return data;
}
export async function pending(user: string): Promise<Mutation[]> {
  return (await (await db()).getAll("outbox"))
    .filter((x) => x.owner === user)
    .sort((a, b) => a.enqueued_at - b.enqueued_at);
}
export async function acknowledged(id: string) {
  await (await db()).delete("outbox", id);
}
export async function clearUser(user: string) {
  const tx = (await db()).transaction(["snapshots", "outbox"], "readwrite");
  await tx.objectStore("snapshots").delete(user);
  for (const item of await tx.objectStore("outbox").getAll())
    if (item.owner === user) await tx.objectStore("outbox").delete(item.id);
  await tx.done;
}
