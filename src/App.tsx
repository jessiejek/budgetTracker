import { useEffect, useState, lazy, Suspense, type FormEvent } from "react";
import { Link, NavLink, Route, Routes, useNavigate } from "react-router";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Home,
  List,
  ChartNoAxesCombined,
  Settings as SettingsIcon,
  Tags,
  ChevronRight,
  LogOut,
  Wallet as WalletIcon,
  X,
  Download,
  RefreshCw,
} from "lucide-react";
const SpendingChart = lazy(() => import("./components/SpendingChart"));
import { isConfigured, supabase } from "./lib/supabase";
import { useLedger } from "./lib/useLedger";
import { clearUser } from "./lib/offline";
import { money, monthKey, parseAmount, today } from "./lib/money";
import type { Budget, Category, Kind, Transaction } from "./lib/types";

type Ledger = ReturnType<typeof useLedger>;
const monthName = (month: string) =>
  new Date(month + "T12:00:00").toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });
function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-mark" aria-hidden="true">
        —
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function PageTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {action}
    </header>
  );
}
function MonthPicker({
  month,
  setMonth,
}: {
  month: string;
  setMonth: (value: string) => void;
}) {
  return (
    <label className="month-picker">
      <span className="sr-only">Choose month</span>
      <input
        type="month"
        value={month.slice(0, 7)}
        onChange={(e) => e.target.value && setMonth(e.target.value + "-01")}
      />
    </label>
  );
}
function TransactionList({
  items,
  data,
}: {
  items: Transaction[];
  data: Ledger["data"];
}) {
  if (!items.length)
    return (
      <Empty title="Nothing here yet">
        Add your first transaction. Every small expense counts.
      </Empty>
    );
  return (
    <ul className="transaction-list">
      {items.map((t) => (
        <li key={t.id}>
          <span className={"transaction-icon " + t.kind}>
            {t.kind === "income" ? (
              <ArrowDownLeft size={19} />
            ) : (
              <ArrowUpRight size={19} />
            )}
          </span>
          <div className="transaction-copy">
            <strong>
              {t.note ||
                data.categories.find((c) => c.id === t.category_id)?.name ||
                "Transaction"}
            </strong>
            <span>
              {data.categories.find((c) => c.id === t.category_id)?.name} ·{" "}
              {data.wallets.find((w) => w.id === t.wallet_id)?.name} ·{" "}
              {new Date(t.occurred_on + "T12:00:00").toLocaleDateString(
                "en-PH",
                { month: "short", day: "numeric" },
              )}
            </span>
          </div>
          <strong className={"amount " + t.kind}>
            {t.kind === "income" ? "+" : "−"}
            {money(t.amount)}
          </strong>
        </li>
      ))}
    </ul>
  );
}
function Overview({
  ledger,
  month,
  setMonth,
}: {
  ledger: Ledger;
  month: string;
  setMonth: (v: string) => void;
}) {
  const { data } = ledger;
  const tx = data.transactions.filter((t) => monthKey(t.occurred_on) === month);
  const spent = tx
    .filter((t) => t.kind === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const income = tx
    .filter((t) => t.kind === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const budget = data.budgets
    .filter((b) => b.month === month)
    .reduce((s, b) => s + Number(b.amount), 0);
  const chart = data.categories
    .filter((c) => c.kind === "expense")
    .map((c) => ({
      name: c.name,
      value: tx
        .filter((t) => t.kind === "expense" && t.category_id === c.id)
        .reduce((s, t) => s + Number(t.amount), 0),
      color: c.color,
    }))
    .filter((c) => c.value > 0);
  const ratio = budget > 0 ? Math.min(spent / budget, 1) : 0;
  return (
    <>
      <PageTitle
        eyebrow="A LITTLE CLARITY, EVERY DAY"
        title="Your money, at a glance."
      />
      <div className="section-heading">
        <h2>{monthName(month)}</h2>
        <MonthPicker month={month} setMonth={setMonth} />
      </div>
      <div className="summary-grid">
        <section className="spending-card" aria-label="Monthly spending">
          <span>Spent this month</span>
          <div className="spending-ring">
            <svg viewBox="0 0 220 220" aria-hidden="true">
              <circle
                cx="110"
                cy="110"
                r="100"
                fill="none"
                stroke="#70877c"
                strokeWidth="8"
              />
              <circle
                cx="110"
                cy="110"
                r="100"
                fill="none"
                stroke="#d0e48f"
                strokeWidth="8"
                strokeDasharray="628.32"
                strokeDashoffset={628.32 * (1 - ratio)}
                transform="rotate(-90 110 110)"
              />
            </svg>
            <div>
              <strong>{money(spent)}</strong>
              <span>
                {budget
                  ? `of ${money(budget)} budget`
                  : "Your monthly expenses"}
              </span>
            </div>
          </div>
          <div className="card-bottom">
            <span>
              {budget
                ? spent > budget
                  ? "Over budget"
                  : "Room for this month"
                : "Income this month"}
            </span>
            <strong>{money(budget ? Math.abs(budget - spent) : income)}</strong>
          </div>
        </section>
        <section className="panel summary-card">
          <ArrowDownLeft aria-hidden="true" />
          <span>Income this month</span>
          <strong>{money(income)}</strong>
          <p>Money coming in</p>
        </section>
        <section className="panel summary-card">
          <WalletIcon aria-hidden="true" />
          <span>Net this month</span>
          <strong>{money(income - spent)}</strong>
          <p>Income minus expenses</p>
        </section>
      </div>
      <div className="section-heading">
        <h2>Your wallets</h2>
        <Link to="/settings">
          Manage <ChevronRight size={14} />
        </Link>
      </div>
      <div className="wallet-grid">
        {data.wallets.map((w) => (
          <div className="wallet-chip" key={w.id}>
            <span>{w.name}</span>
            <strong>
              {money(
                Number(w.opening_balance) +
                  data.transactions
                    .filter((t) => t.wallet_id === w.id)
                    .reduce(
                      (s, t) =>
                        s + (t.kind === "income" ? 1 : -1) * Number(t.amount),
                      0,
                    ),
              )}
            </strong>
          </div>
        ))}
      </div>
      <div className="dashboard-details">
        <section className="panel category-chart">
          {chart.length > 0 ? (
            <>
              <h2>Where it went</h2>
              <Suspense
                fallback={
                  <div className="chart-placeholder" role="status">
                    Loading chart…
                  </div>
                }
              >
                <SpendingChart data={chart} />
              </Suspense>
              <ul className="legend">
                {chart.map((c) => (
                  <li key={c.name}>
                    <span>
                      <i style={{ background: c.color }} />
                      {c.name}
                    </span>
                    <strong>{money(c.value)}</strong>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Empty title="Your spending picture">
              Add an expense to see your category breakdown.
            </Empty>
          )}
        </section>
        <section className="panel recent-panel">
          <div className="section-heading">
            <h2>Recent transactions</h2>
            <Link to="/transactions">
              See all <ChevronRight size={14} />
            </Link>
          </div>
          <TransactionList items={tx.slice(0, 5)} data={data} />
        </section>
      </div>
      <Link to="/add" className="fab" aria-label="Add transaction">
        <Plus />
      </Link>
    </>
  );
}
function Transactions({
  ledger,
  month,
  setMonth,
}: {
  ledger: Ledger;
  month: string;
  setMonth: (v: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [kind, setKind] = useState("all"),
    [wallet, setWallet] = useState("all");
  const items = ledger.data.transactions.filter(
    (t) =>
      monthKey(t.occurred_on) === month &&
      (kind === "all" || t.kind === kind) &&
      (wallet === "all" || t.wallet_id === wallet) &&
      `${t.note} ${ledger.data.categories.find((c) => c.id === t.category_id)?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        title="History"
        action={
          <Link to="/add" className="icon-button" aria-label="Add transaction">
            <Plus />
          </Link>
        }
      />
      <div className="history-toolbar">
        <label className="search">
          <span className="sr-only">Search transactions</span>
          <input
            type="search"
            placeholder="Search transactions"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="filters">
          <MonthPicker month={month} setMonth={setMonth} />
          <label>
            <span className="sr-only">Transaction type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="all">All types</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Wallet</span>
            <select value={wallet} onChange={(e) => setWallet(e.target.value)}>
              <option value="all">All wallets</option>
              {ledger.data.wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <p className="muted small">
        {items.length} transaction{items.length === 1 ? "" : "s"} ·{" "}
        {monthName(month)}
      </p>
      <TransactionList items={items} data={ledger.data} />
    </>
  );
}
function AddTransaction({ ledger, user }: { ledger: Ledger; user: string }) {
  const navigate = useNavigate(),
    [kind, setKind] = useState<Kind>("expense"),
    [amount, setAmount] = useState(""),
    [category, setCategory] = useState(""),
    [wallet, setWallet] = useState(""),
    [date, setDate] = useState(today()),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const categories = ledger.data.categories.filter(
    (c) => !c.archived && c.kind === kind,
  );
  const selectedCategory = categories.some((c) => c.id === category)
    ? category
    : (categories[0]?.id ?? "");
  const selectedWallet = wallet || ledger.data.wallets[0]?.id || "";
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (!selectedCategory || !selectedWallet)
        throw new Error(
          "Create a wallet and an active category first in Settings.",
        );
      const value = parseAmount(amount);
      await ledger.save("transactions", {
        id: crypto.randomUUID(),
        user_id: user,
        wallet_id: selectedWallet,
        category_id: selectedCategory,
        kind,
        amount: value,
        note: note.trim(),
        occurred_on: date,
        created_at: new Date().toISOString(),
      });
      navigate("/transactions");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="transaction-page">
      <PageTitle
        title="Add transaction"
        action={
          <Link to="/" className="icon-button" aria-label="Cancel">
            <X />
          </Link>
        }
      />
      <form onSubmit={submit} className="panel form-stack transaction-form">
        <div className="segmented" aria-label="Transaction type">
          {(["expense", "income"] as Kind[]).map((k) => (
            <button
              type="button"
              key={k}
              className={kind === k ? "selected" : ""}
              onClick={() => {
                setKind(k);
                setCategory("");
              }}
              aria-pressed={kind === k}
            >
              {k === "expense" ? "Expense" : "Income"}
            </button>
          ))}
        </div>
        <label className="amount-input">
          <span className="eyebrow">AMOUNT IN PESOS</span>
          <div>
            <span>₱</span>
            <input
              autoFocus
              aria-label="Amount in pesos"
              inputMode="decimal"
              placeholder="0.00"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </label>
        <div className="form-fields">
          <label>
            Category
            <select
              required
              value={selectedCategory}
              onChange={(e) => setCategory(e.target.value)}
            >
              {!categories.length && (
                <option value="">No active categories</option>
              )}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Paid {kind === "expense" ? "from" : "into"}
            <select
              required
              value={selectedWallet}
              onChange={(e) => setWallet(e.target.value)}
            >
              {!ledger.data.wallets.length && (
                <option value="">No wallets</option>
              )}
              {ledger.data.wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Note <span className="muted">(optional)</span>
            <input
              maxLength={200}
              placeholder="What was it for?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary" disabled={saving || ledger.loading}>
          {saving ? "Saving…" : `Save ${kind}`}
        </button>
        <p className="muted small center">
          Saved on this device first. Synced when you’re online.
        </p>
      </form>
    </section>
  );
}
function Budgets({
  ledger,
  user,
  month,
  setMonth,
}: {
  ledger: Ledger;
  user: string;
  month: string;
  setMonth: (v: string) => void;
}) {
  const [category, setCategory] = useState(""),
    [amount, setAmount] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const categories = ledger.data.categories.filter(
    (c) => c.kind === "expense" && !c.archived,
  );
  const selected = category || categories[0]?.id || "";
  const budgets = ledger.data.budgets.filter((b) => b.month === month);
  const spent = (b: Budget) =>
    ledger.data.transactions
      .filter(
        (t) =>
          t.category_id === b.category_id &&
          t.kind === "expense" &&
          monthKey(t.occurred_on) === month,
      )
      .reduce((s, t) => s + Number(t.amount), 0);
  const planned = budgets.reduce((s, b) => s + Number(b.amount), 0),
    used = budgets.reduce((s, b) => s + spent(b), 0);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (!selected) throw new Error("Add an expense category first.");
      const existing = budgets.find((b) => b.category_id === selected);
      await ledger.save("budgets", {
        id: existing?.id ?? crypto.randomUUID(),
        user_id: user,
        category_id: selected,
        month,
        amount: parseAmount(amount),
      });
      setAmount("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save budget.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <PageTitle title="Budgets" />
      <div className="section-heading">
        <MonthPicker month={month} setMonth={setMonth} />
        <span className="muted small">Make room for what matters.</span>
      </div>
      <section className="panel budget-summary">
        <span>{used > planned ? "Over budget" : "Remaining"}</span>
        <strong>{money(Math.abs(planned - used))}</strong>
        <p>
          {money(used)} spent of {money(planned)} planned
        </p>
      </section>
      <div className="management-layout">
        <div>
          <div className="budget-list">
            {budgets.map((b) => {
              const used = spent(b),
                c = ledger.data.categories.find((c) => c.id === b.category_id);
              return (
                <section className="panel" key={b.id}>
                  <div className="section-heading">
                    <h3>
                      {c?.name}
                      {c?.archived ? " · Archived" : ""}
                    </h3>
                    <span className={used > Number(b.amount) ? "danger" : ""}>
                      {Math.round((used / Number(b.amount)) * 100)}%
                    </span>
                  </div>
                  <progress
                    max={Number(b.amount)}
                    value={Math.min(used, Number(b.amount))}
                    aria-label={`${c?.name} budget spent`}
                  />
                  <div className="section-heading small muted">
                    <span>
                      {money(used)} / {money(b.amount)}
                    </span>
                    <span>
                      {used > Number(b.amount) ? "Over by " : "Left "}
                      {money(Math.abs(Number(b.amount) - used))}
                    </span>
                  </div>
                </section>
              );
            })}
          </div>
          {!budgets.length && (
            <Empty title="A plan, not a restriction">
              Set a monthly limit for a category to see your progress.
            </Empty>
          )}
        </div>
        <form className="panel form-stack editor-panel" onSubmit={submit}>
          <h2>Set a category budget</h2>
          <label>
            Category
            <select
              value={selected}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              {!categories.length && (
                <option value="">No active expense categories</option>
              )}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Monthly limit (₱)
            <input
              inputMode="decimal"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="5,000.00"
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={saving || ledger.loading}>
            {saving ? "Saving…" : "Save budget"}
          </button>
          <p className="small muted">
            Saving an existing category replaces its limit for this month.
          </p>
        </form>
      </div>
    </>
  );
}
function Categories({ ledger, user }: { ledger: Ledger; user: string }) {
  const [editing, setEditing] = useState<Category | null>(null),
    [name, setName] = useState(""),
    [kind, setKind] = useState<Kind>("expense"),
    [color, setColor] = useState("#527565"),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Enter a category name.");
      if (
        ledger.data.categories.some(
          (c) =>
            c.id !== editing?.id &&
            c.kind === kind &&
            c.name.toLowerCase() === trimmed.toLowerCase(),
        )
      )
        throw new Error("A category with that name already exists.");
      await ledger.save("categories", {
        id: editing?.id ?? crypto.randomUUID(),
        user_id: user,
        name: trimmed,
        kind,
        color,
        archived: editing?.archived ?? false,
      });
      setEditing(null);
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save category.");
    } finally {
      setSaving(false);
    }
  }
  async function archive(c: Category) {
    try {
      await ledger.save("categories", { ...c, archived: !c.archived });
    } catch {
      setError("Could not update category. Please retry.");
    }
  }
  return (
    <>
      <PageTitle title="Your categories" />
      <p className="muted intro">
        Make them yours. Archiving hides a category from new entries, without
        changing your history.
      </p>
      <div className="management-layout">
        <ul className="category-list">
          {ledger.data.categories.map((c) => (
            <li key={c.id} className={c.archived ? "archived" : ""}>
              <i style={{ background: c.color }} />
              <div>
                <strong>{c.name}</strong>
                <span>
                  {c.kind}
                  {c.archived ? " · Archived" : ""}
                </span>
              </div>
              <button
                className="text-button"
                onClick={() => {
                  setEditing(c);
                  setName(c.name);
                  setKind(c.kind);
                  setColor(c.color);
                }}
              >
                Edit
              </button>
              <button className="text-button" onClick={() => void archive(c)}>
                {c.archived ? "Restore" : "Archive"}
              </button>
            </li>
          ))}
        </ul>
        <form className="panel form-stack editor-panel" onSubmit={submit}>
          <div className="section-heading">
            <h2>{editing ? "Edit category" : "New category"}</h2>
            {editing && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setEditing(null);
                  setName("");
                }}
              >
                Cancel
              </button>
            )}
          </div>
          <label>
            Name
            <input
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Food & groceries"
            />
          </label>
          <label>
            Type
            <select
              value={kind}
              disabled={!!editing}
              onChange={(e) => setKind(e.target.value as Kind)}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </label>
          <label>
            Color
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={saving || ledger.loading}>
            {saving ? "Saving…" : "Save category"}
          </button>
        </form>
      </div>
    </>
  );
}
function Settings({
  ledger,
  user,
  session,
  onSignOut,
}: {
  ledger: Ledger;
  user: string;
  session: Session;
  onSignOut: () => Promise<void>;
}) {
  const [name, setName] = useState(""),
    [opening, setOpening] = useState("0"),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  async function wallet(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const balance = Number(opening);
      if (!name.trim()) throw new Error("Enter a wallet name.");
      if (
        !/^-?\d+(\.\d{1,2})?$/.test(opening) ||
        !Number.isFinite(balance) ||
        Math.abs(balance) > 999999999.99
      )
        throw new Error(
          "Enter a valid opening balance with up to two decimal places.",
        );
      if (
        ledger.data.wallets.some(
          (w) => w.name.toLowerCase() === name.trim().toLowerCase(),
        )
      )
        throw new Error("This wallet already exists.");
      await ledger.save("wallets", {
        id: crypto.randomUUID(),
        user_id: user,
        name: name.trim(),
        opening_balance: balance,
      });
      setName("");
      setOpening("0");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save wallet.");
    } finally {
      setSaving(false);
    }
  }
  function exportCSV() {
    const cell = (v: unknown) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const rows = [
      ["Date", "Type", "Category", "Wallet", "Amount PHP", "Note"],
      ...ledger.data.transactions.map((t) => [
        t.occurred_on,
        t.kind,
        ledger.data.categories.find((c) => c.id === t.category_id)?.name,
        ledger.data.wallets.find((w) => w.id === t.wallet_id)?.name,
        t.amount,
        t.note,
      ]),
    ];
    const blob = new Blob(
      ["\ufeff" + rows.map((r) => r.map(cell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-tracker-${today()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <PageTitle title="Settings" />
      <div className="settings-grid">
        <div className="settings-account">
          <section className="panel profile">
            <span className="avatar">
              {(
                session.user.user_metadata.full_name ||
                session.user.email ||
                "You"
              ).slice(0, 1)}
            </span>
            <div>
              <strong>
                {session.user.user_metadata.full_name || "Your account"}
              </strong>
              <p className="muted small">Connected with Google</p>
            </div>
          </section>
          <p className="eyebrow section-label">ORGANIZE</p>
          <Link className="settings-row" to="/categories">
            <Tags size={19} />
            <span>
              <strong>Categories</strong>
              <small>Your personal categories</small>
            </span>
            <ChevronRight size={18} />
          </Link>
        </div>
        <section className="panel settings-wallets">
          <h2>Your wallets</h2>
          <ul className="wallet-list">
            {ledger.data.wallets.map((w) => (
              <li key={w.id}>
                <WalletIcon size={17} />
                <span>{w.name}</span>
                <strong>
                  {money(
                    Number(w.opening_balance) +
                      ledger.data.transactions
                        .filter((t) => t.wallet_id === w.id)
                        .reduce(
                          (s, t) =>
                            s +
                            (t.kind === "income" ? 1 : -1) * Number(t.amount),
                          0,
                        ),
                  )}
                </strong>
              </li>
            ))}
          </ul>
          <form className="form-stack" onSubmit={wallet}>
            <h3>Add a wallet</h3>
            <label>
              Name
              <input
                value={name}
                required
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder="Savings"
              />
            </label>
            <label>
              Opening balance (₱)
              <input
                inputMode="decimal"
                required
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="secondary" disabled={saving || ledger.loading}>
              {saving ? "Saving…" : "Add wallet"}
            </button>
          </form>
        </section>
        <div className="settings-preferences">
          <p className="eyebrow section-label">PREFERENCES</p>
          <div className="settings-row">
            <span>Currency</span>
            <strong>PHP · Philippine peso</strong>
          </div>
          <div className="settings-row">
            <span>Dates</span>
            <strong>Local calendar dates</strong>
          </div>
          <p className="eyebrow section-label">YOUR DATA</p>
          <button className="settings-row full" onClick={exportCSV}>
            <Download size={18} />
            <span>
              <strong>Export CSV</strong>
              <small>Take your records with you</small>
            </span>
            <ChevronRight size={18} />
          </button>
          <button
            className="settings-row full"
            onClick={() => void ledger.refresh()}
          >
            <RefreshCw size={18} />
            <span>Sync now</span>
            <small>{ledger.queued} pending</small>
          </button>
          <button
            className="settings-row full"
            disabled={ledger.queued > 0}
            onClick={() => void onSignOut()}
          >
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
          {ledger.queued > 0 && (
            <p className="small muted">
              Sync pending changes before signing out so nothing is lost.
            </p>
          )}
        </div>
      </div>
      <p className="small muted center">
        Budget Tracker · a quieter way to track your pesos.
      </p>
    </>
  );
}
export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [authLoading, setAuthLoading] = useState(true),
    [authError, setAuthError] = useState(""),
    [month, setMonth] = useState(monthKey(today())),
    [update, setUpdate] = useState<null | (() => void)>(null);
  const ledger = useLedger(session?.user.id);
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) {
        setSession(next);
        setAuthLoading(false);
      }
    });
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active) {
          setSession(data.session);
          setAuthError(error?.message ?? "");
          setAuthLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setAuthError("Could not restore your session. Please retry.");
          setAuthLoading(false);
        }
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    const listener = (e: Event) =>
      setUpdate(() => (e as CustomEvent<() => void>).detail);
    window.addEventListener("pwa-update", listener);
    return () => window.removeEventListener("pwa-update", listener);
  }, []);
  async function login() {
    if (!supabase) return;
    setAuthError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) setAuthError(error.message);
    } catch {
      setAuthError(
        "Sign-in could not start. Check your connection and try again.",
      );
    }
  }
  async function signOut() {
    if (ledger.queued) return;
    const user = session?.user.id;
    try {
      const { error } = await supabase!.auth.signOut();
      if (error) throw error;
      if (user) await clearUser(user);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Could not sign out.");
    }
  }
  if (authLoading)
    return (
      <div className="app-shell">
        <div className="loading" role="status">
          Getting things ready…
        </div>
      </div>
    );
  if (!session)
    return (
      <div className="login-shell">
        <div className="brand">BUDGET TRACKER</div>
        <main>
          <p className="eyebrow">LESS GUESSING. MORE LIVING.</p>
          <h1>
            Know where
            <br />
            your pesos go.
          </h1>
          <p className="login-copy">
            Log daily spending. See what’s left.
            <br />
            Start with your Google account.
          </p>
          <section className="login-preview" aria-label="Product preview">
            <div className="section-heading">
              <strong>A little more clarity</strong>
              <ChartNoAxesCombined size={20} />
            </div>
            <div className="preview-bars" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <p>
              Expenses, wallets and budgets.
              <br />
              Together, without the noise.
            </p>
          </section>
          {!isConfigured && (
            <div className="setup-notice">
              <strong>Ready for setup</strong>
              <p>
                Add the two Supabase environment variables, run the SQL
                migration yourself, and enable Google sign-in. See the README
                for the steps.
              </p>
            </div>
          )}
          <button
            className="primary"
            disabled={!isConfigured}
            onClick={() => void login()}
          >
            Continue with Google <ArrowUpRight size={18} />
          </button>
          {authError && (
            <p role="alert" className="error">
              {authError}
            </p>
          )}
          <p className="small muted center">
            Your records belong to you. No shared accounts.
          </p>
        </main>
        <footer>SMALL CHOICES. CLEARER DAYS.</footer>
      </div>
    );
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="topbar">
        <Link to="/" className="brand">
          BUDGET TRACKER
        </Link>
        <span className="sync-status" role="status">
          {!ledger.online
            ? "Offline"
            : ledger.queued
              ? `${ledger.queued} pending`
              : "Connected"}
        </span>
      </div>
      {update && (
        <div className="notice">
          A new version is ready.{" "}
          <button disabled={ledger.queued > 0} onClick={update}>
            Update app
          </button>
        </div>
      )}
      <main id="main">
        {(authError || ledger.error) && (
          <div role="alert" className="error">
            {authError || ledger.error}
            <button
              onClick={() => void ledger.refresh()}
              className="text-button"
            >
              Retry sync
            </button>
          </div>
        )}
        {ledger.loading ? (
          <div className="loading" role="status">
            <div className="skeleton" />
            <div className="skeleton tall" />
            <p>Loading your records…</p>
          </div>
        ) : (
          <Routes>
            <Route
              path="/"
              element={
                <Overview ledger={ledger} month={month} setMonth={setMonth} />
              }
            />
            <Route
              path="/transactions"
              element={
                <Transactions
                  ledger={ledger}
                  month={month}
                  setMonth={setMonth}
                />
              }
            />
            <Route
              path="/add"
              element={
                <AddTransaction ledger={ledger} user={session.user.id} />
              }
            />
            <Route
              path="/budgets"
              element={
                <Budgets
                  ledger={ledger}
                  user={session.user.id}
                  month={month}
                  setMonth={setMonth}
                />
              }
            />
            <Route
              path="/categories"
              element={<Categories ledger={ledger} user={session.user.id} />}
            />
            <Route
              path="/settings"
              element={
                <Settings
                  ledger={ledger}
                  user={session.user.id}
                  session={session}
                  onSignOut={signOut}
                />
              }
            />
            <Route
              path="*"
              element={
                <>
                  <PageTitle title="Page not found" />
                  <Link to="/">Back to overview</Link>
                </>
              }
            />
          </Routes>
        )}
      </main>
      <nav className="bottom-nav" aria-label="Main navigation">
        <Link
          to="/"
          className="sidebar-brand brand"
          aria-label="Budget Tracker overview"
        >
          BUDGET TRACKER
        </Link>
        <NavLink to="/" end>
          <Home size={20} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/transactions">
          <List size={20} />
          <span>History</span>
        </NavLink>
        <NavLink to="/add" className="add-tab">
          <Plus size={23} />
          <span>Add</span>
        </NavLink>
        <NavLink to="/budgets">
          <ChartNoAxesCombined size={20} />
          <span>Budgets</span>
        </NavLink>
        <NavLink to="/categories" className="desktop-category">
          <Tags size={20} />
          <span>Categories</span>
        </NavLink>
        <NavLink to="/settings">
          <SettingsIcon size={20} />
          <span>Settings</span>
        </NavLink>
      </nav>
    </div>
  );
}
