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


## Mobile-first UI iteration — 12 Oct 2026

### Done
- Added a phone-first layout layer while retaining the Refero Styles editorial direction (white canvas, restrained ink/gray palette, serif display headings, quiet borders).
- Made the society header sticky and compact on small screens, with larger language/sign-out tap targets.
- Reworked mobile navigation into a sticky, horizontally scrollable chip bar so all resident/admin sections remain reachable without a cramped multi-row menu.
- Highlighted the active mobile navigation item with a high-contrast treatment.
- Improved small-screen reading order, content spacing, metric cards, festival/programme records, and form controls.
- Increased mobile input and select sizing to reduce iOS zoom, and made primary form actions full-width for easier tapping.
- Added safe-area awareness, narrow-screen fallbacks, touch-friendly controls, and reduced-motion handling.

### Ongoing / verify before calling complete
- The CSS has been committed, but visual testing on real iPhone/Android viewport sizes and the live Cloudflare deployment is still required.
- Check every view (Overview, Notices, Payments, Fund records, Navratri, Programmes, Manage houses, Admin review), especially long forms and Gujarati labels.
- Confirm horizontal navigation can reach every tab and that sticky header/navigation do not obscure content or focused fields.
- Verify no horizontal page overflow at 320px, 360px, 390px, and 430px widths; then refine any screen-specific issues.

### Remaining
- Run authenticated mobile smoke tests for both admin and resident accounts.
- Verify touch targets, keyboard behavior, scrolling, and browser back/refresh behavior on a physical phone.
- Confirm the newest commit has deployed to Cloudflare before relying on the live site.

This iteration changes presentation only; it does not change the database schema, permissions, or production festival data.


## Final mobile UI refinement — 12 Oct 2026

### Done
- Changed the public House Directory from a large always-visible block to a collapsed disclosure. It no longer competes visually with sign-in; residents' names and contact details remain private.
- Changed authenticated mobile navigation to a fixed bottom navigation strip with safe-area spacing, clearer active state, and touch-friendly controls.
- Kept the mobile UI aligned to the selected Refero Styles editorial system: white canvas, ink typography, quiet borders, and restrained secondary surfaces.
- Used mobile navigation and data-entry design principles from the official Anthropic Claude Code frontend-design skill as a quality reference, alongside Refero's real-screen UX research.

### Still to verify
- Confirm the bottom navigation is usable across all 8 sections on a physical phone and that horizontal scrolling is discoverable.
- Test long admin forms, keyboard focus, Gujarati text, and browser safe areas on 320px–430px screens.
- Verify the live Cloudflare deployment and run admin/resident authenticated smoke tests. These have not been claimed as complete.

### Design decision
The public directory is secondary utility, not the main product entry point. Sign-in and authenticated society tasks should carry the visual priority. This change is presentation-only; no database or production data was changed.


## Mobile selection and festival contribution consistency — 12 Oct 2026

### Done
- Replaced all 8 native select menus in the UI with a shared custom picker. On phones, choices open in a bottom-sheet style panel with large tap targets, a dimmed backdrop, selected-state styling, and a clear close/selection action. The underlying select remains the form value source so existing FormData flows continue to work.
- Applied the same selection interaction to house, fund, payment method, preferred language, festival category/source, and other dropdowns.
- Removed the per-household contribution-rate dropdown in the Navratri form. The current UI now applies one fixed rate of ₹500 per participating member to each household for the festival; the rate is no longer independently selectable per house.
- Kept the rate explanation visible so admins understand that the amount is consistent across households.

### Important limitation / next decision
- The current data model stores the per-person rate on each household row, not as a festival-season setting. This UI iteration enforces ₹500 consistently when an admin saves a household, but does not add a season-level configurable rate. If the society needs to change the amount for a future festival, the schema and admin season settings should be migrated to store the rate once on navratri_seasons and derive every household's due from that season value.
- Custom picker behavior is implemented in code but still needs browser/phone testing for keyboard navigation, long option lists, and all dynamic forms.
- No database schema or production festival records were changed in this iteration.


## Festival household entry workflow — 12 Oct 2026

### Done
- Reworked the Navratri household setup around one shared per-person festival rate input.
- Added an "apply rate to all houses" action that updates the rate on all household rows in the current season while retaining each home's participant count.
- Added tappable house-number cards. Each card shows people and the calculated household due amount.
- Tapping a house opens a mobile bottom sheet with the participant count, live automatic total calculation, Save, Cancel, and Close actions.
- Existing household data can be corrected by tapping the same house card and saving the corrected participant count.
- Retained the payment recording controls and existing contribution ledger list beneath the house picker.

### Important behavior
- The shared rate is stored across the season's household rows because the current schema does not have a season-level rate column. This keeps the rate consistent in the current UI, but a proper database migration to store the rate once on the season remains the cleaner long-term design.
- The amount is calculated as participant count × shared rate. A count of zero produces a zero contribution due.

### Remaining verification
- Test that rate changes persist across reloads and that due totals recalculate correctly for all 19 houses.
- Test edit/save flows and contribution recording on a phone, including keyboard and bottom-sheet behavior.
- Check that this newest commit has deployed to Cloudflare. No production database schema changes were made by this UI iteration.


## Token receipt tracking and mobile controls — 12 Oct 2026

### Done
- Added token dashboard totals for total participating members, tokens marked received today, and outstanding count.
- Added a "People still waiting" list with red pending status and a quick action to mark a token record as received.
- Added today's token record list with green received / red pending statuses.
- Added a dedicated quick-assignment token form with house, member label, and token count.
- Reduced bottom navigation button height and padding for a less bulky mobile footer.

### Still remaining
- The household cards do not yet include a working call button. A reliable call action needs a real, authorized resident contact number for each house; the UI must not fabricate or expose private numbers.
- House-card-level quick assignment shortcuts still need to be wired to the token form.
- Current receipt totals count token records marked received; the society must confirm whether token_count represents individual members or physical tokens before using the pending total as an attendance guarantee.
- Test token entry, receipt status, totals, Gujarati labels, and phone layouts against the live deployment. No production database records were changed.
