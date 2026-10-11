# Sonalpark Society Gate-2 Portal

A static, responsive resident portal for **Sonalpark Society Gate-2**, serving houses **31–49 (19 houses)**. The frontend is connected to Supabase using a browser-safe publishable key.

## Latest project status — 12 October 2026

### Done
- Supabase project is connected; all 19 houses (31–49) exist.
- Admin login has been confirmed by the owner; house-management and house-number login code is committed.
- Public house-number directory, English/Gujarati toggle and resident portal are present.
- Supabase Edge Function `manage-house-resident` is deployed.
- Header now uses a bold, standalone society emblem with no duplicate wording; favicon matches the emblem.
- Five Navratri tables have been created: seasons, household participation/contribution targets, contributions received, daily tokens and expenses.
- RLS is enabled on all five Navratri tables; policies restrict writes to admins and limit resident reads to their own house where applicable.
- Initial Navratri UI is committed: create/close a season, set each household's participant count and per-person contribution, record household payments, add/mark daily tokens received, and record expenses.
- Initial responsive CSS changes support smaller/mobile screens.
- The README is maintained as the project status record.

### Ongoing — current priority
- Validate Navratri calculations and permissions before real financial use.
- Verify latest GitHub changes have reached the live Cloudflare deployment.
- Test the full experience on an actual mobile phone.

### Navratri database status
- Houses: 19 (31–49).
- Navratri seasons created: 0.
- Household participation records: 0.
- Contributions, token records and expenses: 0.
- No test or real festival transactions have been inserted yet.

### Remaining
- Create a test Navratri season; its initial household rows are created when the admin creates the season.
- Add a clear date-specific token distribution view with pending-first filtering and a quick contact action for households whose tokens are pending.
- Verify collection totals, household paid/pending amounts, and remaining balance with sample records.
- Ensure expenses paid from the main society fund do not reduce the Navratri contribution balance.
- Test that residents can see only their own household's contribution/token information and cannot create or modify admin records.
- Test empty states, error handling, duplicate submissions and mobile form behavior.
- Enable Supabase leaked-password protection; the security advisor reported this setting is disabled.
- Browser push and WhatsApp delivery, plus broader society modules, remain future work.

### Accounting and security caution
The Navratri module is an initial implementation, not yet production-verified. It currently records contributions and expenses separately, but sample-based reconciliation and permission tests are still required. Use test records only until totals, fund separation, resident privacy and admin-only writes are confirmed. Never place a Supabase service-role/secret key in browser code.

## Current portal

- Admin sign-in with email/password; residents sign in using their house number (31–49) and password.
- Read-only public directory shows house numbers and active status without exposing resident names or phone numbers.
- Admin-only house management form stores resident name and private contact phone, creates the house login, and can disable a house login.
- Email/password sign-in; public sign-up is intentionally disabled.
- English/Gujarati interface toggle.
- Published notices and meetings.
- Resident payment submission and payment history.
- Admin payment review (database RPC atomically updates payment status, ledger and audit log).
- Separate Maintenance, Festival and General fund ledger views.
- Programme/expense-share display.
- RLS enabled on all public tables.

## Preview locally

Open `index.html` in a browser, or run:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000. The page loads the Supabase JavaScript client from a pinned CDN version, so internet access is required.

## Supabase setup

See [docs/supabase-setup.md](docs/supabase-setup.md) for project details, creating the first admin and adding resident accounts.

- Project ref: `cfrvkrsqomtrgvejxeub`
- Region: Mumbai, India (`ap-south-1`)
- Project URL: `https://cfrvkrsqomtrgvejxeub.supabase.co`

**Never put a Supabase service-role or secret key in this repository or browser code.** The publishable key in `index.html` is designed for browser use; RLS is the actual data-access boundary.

## Deployment

The `main` branch is updated. If your current Cloudflare deployment is connected to this GitHub repository, a new deployment should start automatically after the commit. Check Cloudflare's deployment status and open the live URL after it finishes.

For a new Cloudflare Pages Git deployment:
1. Choose repository `dhrumilM1999/society-management` and branch `main`.
2. Framework preset: **None**.
3. Build command: blank or `exit 0`.
4. Output directory: `.`.

The project was previously deployed by the owner at a `workers.dev` address. A Workers deployment and a Pages deployment are distinct; use the existing deployment method unless you intend to migrate it.

## Database and test status

The initial schema and hardening migrations are applied. Houses 31–49 are present. Five Navratri tables have RLS enabled. The current security advisor reported a warning: leaked-password protection is disabled. Navratri tables are empty until an admin creates a season and test records.

The administrator profile is provisioned and admin sign-in has been confirmed by the owner. Resident/admin role-isolation still needs an end-to-end test with a confirmed resident account. Do not use real financial records until a test resident is verified and payment confirmation/rejection, Navratri totals, fund separation and permissions have been exercised. Programme share calculation/finalization, browser push and WhatsApp delivery remain future implementation work.
