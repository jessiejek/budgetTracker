# Saldo · budgetTracker

A mobile-first, PHP expense tracker. React 19 + Vite + TypeScript + Tailwind v4, Supabase, IndexedDB (`idb`), React Router and Recharts. Clean forest-green / paper design, installable PWA, no gradients or emoji icons.

## 1. Run locally

```sh
source ~/.nvm/nvm.sh
nvm use 22.12.0
npm install
cp .env.example .env.local
```

Set these **public client** environment variables in `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

Never use a service-role key. `.env` and `.env.*` are ignored except the example. Without configuration, the app displays setup guidance rather than crashing.

```sh
npm run dev
npm test
npm run build
npm run test:smoke
npm run preview
```

## 2. Apply the database migration yourself

In your Supabase project's **SQL Editor**, paste and run:

`supabase/migrations/20261108170000_init.sql`

Use a fresh project and run the migration once. It is transactional, creates `profiles`, `wallets`, `categories`, `transactions`, `budgets`, and `recurring`, enables RLS on all six, and grants access only to each authenticated user's own rows. Composite foreign keys prevent cross-user wallet/category links. The signup trigger creates a profile, Cash / GCash / Bank wallets, and independent copies of the default categories. It also initializes existing auth users when the migration runs. Categories can be edited or archived without deleting transaction history.

**The agent, application build, and deployment do not run SQL or connect to the database. Jessie runs migrations manually.** The application's Supabase reads and writes begin only after the user signs in in their own browser. No database credentials are required at build time.

`recurring` is schema groundwork only; automatic scheduling and recurring-entry UI are not implemented in this initial version. No background job creates transactions.

## 3. Enable Google OAuth

1. In Google Cloud Console, configure the OAuth consent screen and a Web application OAuth client. While the consent screen is in testing, add your Google account as a test user.
2. Add the **exact Supabase callback URL** shown under Supabase Authentication → Providers → Google to Google's authorized redirect URIs (usually `https://PROJECT_REF.supabase.co/auth/v1/callback`). Google client secrets stay in Supabase, never in Vite env vars.
3. Enable Google in Supabase Authentication → Providers and save the Google client ID and secret there.
4. Under Authentication → URL Configuration, set the production Site URL to your actual Vercel origin. Add `http://localhost:5173` and your production origin to Redirect URLs. Add only trusted preview origins if using preview deployments.
5. Start the app and choose **Continue with Google**. The app returns to its origin after OAuth.

## 4. Deploy with Vercel

1. Add New → Project → import `jessiejek/budgetTracker` from GitHub.
2. Framework: **Vite**. Root: repository root. Install: `npm install`; build: `npm run build`; output: `dist`.
3. Use Node **22.x** on Vercel (the local development version is pinned to 22.12.0 in `.nvmrc`).
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the appropriate Vercel environments before deploying. These are compiled into the public frontend; never add privileged keys.
5. Deploy and add the resulting HTTPS origin to Supabase's Site URL / Redirect URLs. Redeploy after changing Vite environment variables.

`vercel.json` rewrites client-side routes to the SPA entry point. HTTPS enables service workers and installation. Android / desktop: install from browser menu; iPhone: Safari → Share → Add to Home Screen.

## Features

- Overview: selected-month spending, category breakdown, wallet balances and recent activity.
- History: search, month, wallet and expense/income filters.
- Add transaction: positive centavo-precision amounts, category, wallet, local date and note.
- Budgets: per-category / per-month limits and remaining amounts.
- Categories: create, rename, recolor, archive and restore your own copies. Type is fixed after creation to preserve history.
- Settings: create wallets with opening balances, export CSV, manual sync and sign out.
- Accessible bottom navigation, focus states, loading, empty and error states.

## Offline and privacy

After the first successful online sign-in and sync, the PWA shell and your account's latest snapshot are available offline. Writes are saved in IndexedDB first and queued in order for replay on reconnect, on manual sync, or every 30 seconds while the app is open. UUID upserts make replay idempotent. The status label shows offline / pending. Errors retain the queue for retry. The app must be open to sync; it does not claim background sync while closed.

Cached records and queues are namespaced per user, but IndexedDB is **not encrypted**. Only use a trusted browser/device. Sign-out is disabled until pending writes are synced, then clears that user's local snapshot and queue. The service worker only precaches static app assets, not Supabase responses or OAuth tokens. Updates are offered rather than force-reloaded and are disabled while writes are pending.

Concurrent edits to the same row from different devices use last-write-wins. Wallet transfers, transaction editing/deletion, recurring automation, multi-currency, and conflict resolution are outside this initial scaffold. CSV exports quote fields and neutralize leading spreadsheet formula markers.

## Verification boundary

Build and pure money-format / amount-validation tests can run without any Supabase environment variables or database access. Live OAuth, RLS isolation and online/offline replay require manual acceptance testing by Jessie after setup; they are not represented as integration-tested against a live database.

### Dependency audit note

The initial npm audit reports 6 transitive development/build-tool advisories (2 low, 4 moderate) in the Workbox toolchain (`deepmerge`, `glob`, `minimatch` and dependents). A non-breaking `npm audit fix` currently leaves them unresolved. They are not application runtime dependencies. Recheck and update the PWA/Workbox toolchain when compatible fixes are published; do not blindly force major upgrades.
