import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import {
  persist,
  pending,
  cached,
  cache,
  acknowledged,
  clearUser,
} from "./offline.ts";
import { emptyData, type Transaction, type Category } from "./types.ts";

test("offline writes are ordered, atomic, account-scoped, and replay-safe", async () => {
  const user = "test-user-a";
  const category: Category = {
    id: "cat-1",
    user_id: user,
    name: "Food",
    kind: "expense",
    color: "#173f38",
    archived: false,
  };
  await persist(user, { id: "z-first", table: "categories", row: category });
  const expense: Transaction = {
    id: "tx-1",
    user_id: user,
    wallet_id: "cash",
    category_id: "cat-1",
    kind: "expense",
    amount: 150.25,
    note: "Lunch",
    occurred_on: "2026-11-08",
    created_at: "2026-11-08T08:00:00Z",
  };
  await persist(user, { id: "a-second", table: "transactions", row: expense });
  assert.deepEqual(
    (await pending(user)).map((m) => m.id),
    ["z-first", "a-second"],
  );
  assert.equal((await cached(user))?.transactions[0].amount, 150.25);
  assert.equal((await pending("test-user-b")).length, 0);
  assert.equal(await cached("test-user-b"), undefined);
  const merged = await cache(user, emptyData());
  assert.equal(
    merged.transactions.length,
    1,
    "a stale network snapshot cannot remove queued entries",
  );
  assert.equal(merged.categories.length, 1);
  await persist(user, {
    id: "b-third",
    table: "transactions",
    row: { ...expense, note: "Updated lunch" },
  });
  assert.equal(
    (await cached(user))?.transactions.length,
    1,
    "upserts do not duplicate transactions",
  );
  assert.equal((await cached(user))?.transactions[0].note, "Updated lunch");
  await acknowledged("z-first");
  assert.equal((await pending(user)).length, 2);
  await clearUser(user);
  assert.equal(await cached(user), undefined);
  assert.equal((await pending(user)).length, 0);
});

test("history sorts newest dates before creation timestamps", async () => {
  const user = "test-user-c";
  const base: Transaction = {
    id: "one",
    user_id: user,
    wallet_id: "cash",
    category_id: "food",
    kind: "expense",
    amount: 1,
    note: "",
    occurred_on: "2026-11-01",
    created_at: "2026-11-08T08:00:00Z",
  };
  await persist(user, { id: "one", table: "transactions", row: base });
  await persist(user, {
    id: "two",
    table: "transactions",
    row: { ...base, id: "two", occurred_on: "2026-11-08" },
  });
  assert.deepEqual(
    (await cached(user))?.transactions.map((t) => t.id),
    ["two", "one"],
  );
  await clearUser(user);
});
