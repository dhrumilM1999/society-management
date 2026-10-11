# Sonalpark Society Gate-2 Portal

A static, responsive resident portal for **Sonalpark Society Gate-2**, serving houses **31–49 (19 houses)**. The frontend is connected to Supabase using a browser-safe publishable key.

## Latest project status — 12 October 2026

### Done
- Production Supabase project is connected; all 19 houses (31–49) exist.
- Admin login has been confirmed by the owner; house-management and house-number login code is committed.
- Public house-number directory, English/Gujarati toggle and resident portal are present.
- Supabase Edge Function `manage-house-resident` is deployed in production.
- Header uses a standalone society emblem; favicon matches the emblem.
- Production has five Navratri tables: seasons, household participation/contribution targets, contributions received, daily tokens and expenses.
- Production RLS is enabled on all five Navratri tables; policies restrict writes to admins and limit resident reads to their own house where applicable.
- Initial Navratri UI is committed: create/close a season, set participant counts and per-person contribution, record payments, add/mark daily tokens received, and record expenses.
- Polished the Navratri and Programmes screens with a season hero/status panel, clearer festival metric cards, consistent section/form styling, responsive mobile layouts, and grouped programme expense/share cards.
- Applied a Refero Styles-inspired editorial UI layer: white canvas, restrained charcoal/gray palette, serif display headings, pill-shaped primary actions, quieter borders, and consistent form/card styling. Reference: https://styles.refero.design/.
- Separate Supabase test project `sonalpark-gate-2-test` was created manually by the owner.
- Test project base schema for houses/profiles and the five Navratri tables has been created. All 19 house numbers (31–49) are seeded; RLS is enabled on all five Navratri tables.
- Initial security advisor scan on the test project returned no security findings.
- Added test-project indexes for common Navratri foreign-key and season/date lookups.
- Fixed two Navratri UI issues in GitHub: resident sessions no longer query admin-only expense rows, and the collected total now formats paise as rupees correctly.
- Season creation now uses the exact inserted season ID instead of querying the newest season by creator, avoiding a concurrent-create race.
- The README is maintained as the project status record.

### Ongoing — current priority
- Validate actual test-project sign-in and resident/admin RLS behavior using the configured fake accounts; profile rows and synthetic data are loaded, but browser login and authenticated row-isolation are still pending.
- Exercise contribution calculations, token workflows, expenses and fund separation through the UI and authenticated sessions.
- Inspect and fix frontend issues discovered during tests.
- Verify the latest Navratri/Programmes visual changes in the live Cloudflare deployment and check mobile breakpoints.
- Verify latest GitHub changes have reached the live Cloudflare deployment.
- Test the full experience on an actual mobile phone.

### Production Navratri data status
- Houses: 19 (31–49).
- Navratri seasons created: 0.
- Household participation records: 0.
- Contributions, token records and expenses: 0.
- No test or real festival transactions have been inserted into production.

### Test environment status
- Project: `sonalpark-gate-2-test`
- Project ref: `apkruaouhbogbvbpdnry`
- Region: Mumbai, India (`ap-south-1`)
- Schema check: 19 houses; five Navratri tables; RLS enabled on all five.
- Security advisor: no findings at the initial scan.
- Performance advisor: index/policy efficiency notices were returned; common lookup indexes were added, but the advisor should be rerun.
- Test admin profile is linked to Auth UUID `8c810fc3-7d6c-46bf-8ce4-11fd4cedb395`; test resident profile is linked to Auth UUID `e4478c53-75f1-4528-90d1-7b440e99d44e` and house 33.
- Added synthetic test-only data: one active season, one house-33 household (2 participants × ₹500 = ₹1,000 due), ₹500 collected, ₹100 Navratri-funded expense, and 2 pending tokens. SQL reconciliation returned ₹500 outstanding; test data is clearly labeled and isolated to this test project.
- Auth user IDs are present in test profiles with roles/house assignment as intended. Browser sign-in and authenticated RLS row-isolation have **not** yet been verified.
- Fresh security advisor scan reports one warning: leaked-password protection is disabled in this test project. Performance advisor reports three unindexed foreign keys and multiple permissive SELECT-policy notices; these are performance notices, not confirmed data-access bypasses.

### Remaining
- Open the test-project frontend configured with the test project's URL and publishable key, then verify sign-in as admin and house 33 resident.
- Test that residents can see only their own household contribution/token information and cannot create or modify admin records; current policy definitions have been inspected, but behavior under an authenticated JWT is not yet verified.
- Verify collection totals, household paid/pending amounts, and remaining balance in the UI; the initial SQL reconciliation is correct.
- Ensure expenses paid from the main society fund do not reduce the Navratri contribution balance.
- Verify the resident dashboard avoids admin-only expense queries in an authenticated resident session (the current frontend code has been adjusted, but browser verification is pending).
- Test empty states, error handling, duplicate submissions and mobile form behavior.
- Visually inspect the refreshed festival and programme views in desktop and mobile browsers; Refero-inspired CSS changes are committed but not yet browser-verified.
- Enable leaked-password protection in production; a prior security-advisor check reported this setting disabled.
- Verify Cloudflare deployment status and test on a real phone.
- Browser push and WhatsApp delivery, plus broader society modules, remain future work.

### Test data currently loaded (test project only)
- Season: `TEST ONLY — Navratri 2026` (active; 17–25 October 2026).
- House 33: 2 participants × ₹500 each = ₹1,000 due; ₹500 collected; ₹500 outstanding.
- Navratri-funded test expense: ₹100. Main-society-fund test expense: ₹0.
- Test tokens: 2 pending for house 33.
- All entries are synthetic; production remains unchanged and its Navratri tables remain empty.

### Accounting and security caution
The Navratri module is an initial implementation, not yet production-verified. The test schema is a minimal isolated harness for the Navratri workflow, not a full clone of every production society table. Sample-based reconciliation and permission tests are still required. Use test records only until totals, fund separation, resident privacy and admin-only writes are confirmed. Never place a Supabase service-role/secret key in browser code.

## Current portal
- Admin sign-in with email/password; residents sign in using their house number (31–49) and password.
- Read-only public directory shows house numbers and active status without exposing resident names or phone numbers.
- Admin-only house management form stores resident name and private contact phone, creates the house login, and can disable a house login.
- Public sign-up is intentionally disabled.
- English/Gujarati interface toggle.
- Published notices and meetings.
- Resident payment submission and payment history.
- Admin payment review (database RPC atomically updates payment status, ledger and audit log).
- Separate Maintenance, Festival and General fund ledger views.
- Programme/expense-share display.
- RLS enabled on production public tables.

## Preview locally
Open `index.html` in a browser, or run:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000. The page loads the Supabase JavaScript client from a pinned CDN version, so internet access is required.

## Supabase setup
See [docs/supabase-setup.md](docs/supabase-setup.md) for production project details, creating the first admin and adding resident accounts.

- Production project ref: `cfrvkrsqomtrgvejxeub`
- Test project ref: `apkruaouhbogbvbpdnry`
- Region: Mumbai, India (`ap-south-1`)
- Production project URL: `https://cfrvkrsqomtrgvejxeub.supabase.co`

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
The production schema and hardening migrations are applied. Houses 31–49 are present. Five production Navratri tables have RLS enabled and remain empty. The prior production security advisor check reported that leaked-password protection was disabled.

The test project's minimal Navratri schema has been created and checked. Do not use real financial records until test admin/resident sign-in, row isolation, payment calculations, fund separation and permissions have been exercised. Programme share calculation/finalization, browser push and WhatsApp delivery remain future implementation work.
