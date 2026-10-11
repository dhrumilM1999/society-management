# Sonalpark Society Gate-2 Portal

A static, responsive resident portal for **Sonalpark Society Gate-2**, serving houses **31–49 (19 houses)**. The frontend is connected to Supabase using a browser-safe publishable key.

## Latest project status — 12 October 2026

### Done
- Supabase project is connected; houses 31–49 (19 houses) are present.
- Admin login has been confirmed by the owner; house-management and house-number login code is committed.
- Read-only public house directory and English/Gujarati UI are present.
- Supabase Edge Function `manage-house-resident` is deployed.
- Replaced the old text-bearing logo asset with a standalone, bolder emblem; favicon now matches. The adjacent header text remains the only place the society name is written.
- Created five Navratri tables: seasons, household participation/contribution targets, contribution payments, daily token records and daily expenses.
- Enabled RLS on all five Navratri tables and added admin/resident read rules.
- Added an initial Navratri page for season setup, household contributions, payment records, daily token status and expenses.
- Added responsive CSS adjustments for small/mobile screens.

### Ongoing — current priority
- Verify the updated site after Cloudflare redeploys and test the Navratri screens on a phone.
- Run end-to-end tests for household setup, contribution totals, token receipt updates, expense entry and permissions.
- Check and improve accounting behavior before real money is recorded.

### Remaining
- Create the first Navratri season in the UI; no season or real festival records have been created yet.
- Test login for a real resident and ensure one house cannot read another house's private contribution/token data.
- Improve token workflows with a clear daily pending list and quick phone follow-up.
- Verify that festival balance is calculated correctly when an expense is paid from the main society fund versus Navratri contributions.
- Enable Supabase leaked-password protection; the security advisor currently warns that this is disabled.
- Independently verify Cloudflare deployment and real-device responsive behavior.
- Push notifications, WhatsApp delivery and the other non-Navratri modules remain future work.

### Safety before real financial use
The Navratri schema and first UI are in place, but this is an initial implementation, not yet fully tested for production accounting. Use test records first. Festival contributions must remain separate from the main society fund, and do not enter real financial data until totals, permissions and expense balances have been checked.

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

The initial schema and hardening migrations are applied. Houses 31–49 are present. The five Navratri tables have RLS enabled. The current security advisor reports a warning: leaked-password protection is disabled.

The administrator profile is provisioned and admin sign-in has been confirmed by the owner. Resident/admin role-isolation still needs an end-to-end test with a confirmed resident account. Do not use real financial records until the first admin and a test resident are provisioned and payment confirmation/rejection are exercised. Programme share calculation/finalization, browser push and WhatsApp delivery remain future implementation work.
