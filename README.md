# Sonalpark Society Gate-2 Portal

A static, responsive resident portal for **Sonalpark Society Gate-2**, serving houses **31–49 (19 houses)**. The frontend is connected to Supabase using a browser-safe publishable key.

## Latest project status — 12 October 2026

### Done
- Supabase project connected; 19 houses (31–49) exist in the database.
- Administrator sign-in has been confirmed by the owner.
- Admin house-management workflow and house-number login support have been added to the codebase.
- Read-only public house-number directory and English/Gujarati UI are present.
- Supabase Edge Function `manage-house-resident` is deployed.
- SVG logo, favicon and welcome banner assets exist in `assets/`.

### Ongoing — current priority
- Replace the text-based/old header logo with a bold standalone emblem; keep the society name only in the adjacent heading.
- Simplify the UI and tune layouts for mobile-first use.
- Focus development on the Navratri Festival module before expanding other modules.

### Planned for Navratri
- House-wise participating member counts and contribution amounts (₹400/₹500/₹600 or admin-defined amount).
- Household contribution, paid, pending and payment-status tracking.
- Daily token distribution by household/member, with received/pending lists and contact follow-up.
- Daily expense entry with category, description, amount, date and audit trail.
- Automatic totals for collections, expenses and remaining festival balance, kept separate from the main society fund.
- Mobile-first dashboard and Gujarati/English labels.

### Not done / needs verification
- The generated replacement emblem has not yet been installed in the repository.
- The latest Cloudflare deployment has not been independently verified after recent commits.
- End-to-end resident sign-in and authorization tests need a confirmed test resident.
- Navratri data tables, calculations, payment/token flows and real-device mobile testing are not yet complete.
- Push/WhatsApp notifications and automatic festival share finalization remain future work.

### Safety before real financial use
Do not enter real festival collections or expenses until the Navratri tables, RLS policies, accounting calculations and payment/token workflows have been tested with test records. Festival funds must remain separate from the main society fund.

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

The initial schema and hardening migrations are applied. The database has 12 public tables with RLS enabled and 19 house records for 31–49. The Supabase security advisor currently returns no findings.

The administrator profile is provisioned and admin sign-in has been confirmed by the owner. No resident profiles have been created yet, so house-number login and resident/admin role-isolation still need end-to-end testing with a test resident. Do not use real financial records until the first admin and a test resident are provisioned and payment confirmation/rejection are exercised. Programme share calculation/finalization, browser push and WhatsApp delivery remain future implementation work.
