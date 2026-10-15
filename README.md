# Sonalpark Society Gate-2 Portal

A static, responsive resident portal for **Sonalpark Society Gate-2**, serving houses **31–49 (19 houses)**. The frontend is connected to Supabase using a browser-safe publishable key.

## Latest project status — 12 October 2026

### Done
- **Refunds fixed (15 Oct 2026):** the app now records overpayment refunds in production's own `navratri_refunds` table and subtracts them from what a house has paid (previously it wrote to a column that does not exist, so refunds failed).
- **Programmes & expense sharing (13 Oct 2026):** admins create a programme, add its expenses, choose how the cost is split (all houses equally / only attending houses equally / per person attended), enter attendance with a live split preview, then **Finalize**. Finalizing saves every house's share in one all-or-nothing database function; expenses are locked afterwards and **Reopen** is available until a payment is recorded. Each house's share can be marked paid (and undone) with Call / WhatsApp / SMS reminders. Residents see only their own house share. **Applied to production on 15 Oct 2026** from `docs/migrations/2026-10-13-programmes.sql` (new `prog_*` tables + functions only; nothing existing was changed; verified with a rolled-back dry run as admin and resident). The SQL is tested on a real Postgres engine (`tests/programmes/sql-test.mjs`: split maths, rounding, RLS for admin / resident / anonymous, payments, reopen).
- **UI redesign (12 Oct 2026, mobile-first):** new design system using the emblem's green/navy/gold; bottom tab bar with a "More" sheet on phones and a left sidebar on screens ≥900px; login page reordered so sign-in is first; Navratri split into Houses / Tokens / Expenses tabs; house member entry uses a large +/– stepper; toast messages replace the inline status line. Data logic is unchanged and `tests/navratri/e2e.mjs` covers the new layout.
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


## House quick actions and token follow-up — 12 Oct 2026

### Done in code
- House numbers 31–49 remain the primary tap targets in a compact mobile grid. Selecting a house opens its participant-count details and automatic contribution calculation.
- Each house tile now shows a green paid / red payment-pending indicator based on recorded contributions.
- Added compact per-house **Quick token** and **Receive money** shortcuts. Quick token preselects the house in the token form; Receive money jumps to that house's contribution entry.
- Added **Call** and **WhatsApp** follow-up links beside pending token records when an administrator has a saved resident contact phone number. The WhatsApp link opens a prefilled message; the admin must tap Send in WhatsApp. The call link opens the phone dialer and does not place a call automatically.
- Contact numbers are queried only for admin sessions and are not shown in the public house directory.

### Limitations / verify
- WhatsApp is a user-initiated wa.me link, not a background WhatsApp notification. Automated WhatsApp delivery requires an approved provider/API and explicit configuration; none is connected yet.
- If a house has no saved phone number, the UI explains that no number is available rather than inventing one.
- Confirm admin profile read policies allow the contact lookup, then test house shortcuts, paid/pending colors, call and WhatsApp links on a real phone.
- Code is committed to GitHub; the live Cloudflare deployment and browser behavior have not yet been verified. No database schema or production transactions were changed.


## Auto-generated token waiting list — 12 Oct 2026

- The “People still waiting” list is now generated from each household's saved participant/member count; it no longer depends on an admin manually creating a token record for every member before they appear in the list.
- Each house produces Member 1, Member 2, etc. until the number of members marked received for today reaches that household's participant count.
- Admins can mark a generated member received; this writes a received token record for that house/member and refreshes the dashboard.
- Limitation: household data currently stores a member count, not individual member names. Generated labels are placeholders (Member 1, Member 2). The list is a count-based tracker, so do not treat it as verified named-person attendance until individual member profiles or names are stored. Test with existing pending token rows before relying on the live totals.


## Token-first household workflow — 12 Oct 2026

### Done in code
- Removed the per-house **Receive money** shortcut from the house grid so it no longer competes with daily token work.
- Kept **Quick token** as the house-level action for the repeated daily workflow.
- Kept the contribution ledger and payment-entry form available for the one-time household setup/collection process; existing payment records are not deleted or rewritten.
- Added a separate planning document: [SOCIETY_WORKFLOW_PLAN.md](SOCIETY_WORKFLOW_PLAN.md), listing what is needed, what is already implemented, and what remains.

### Workflow decision
1. Set the household member count.
2. Calculate the household contribution due from the shared per-person rate.
3. Record the household's contribution/payment once during setup/collection.
4. After setup, use the Navratri workspace primarily for quick token assignment and marking tokens received each day.

### Still to do / verify
- The payment-entry form is still visible in the household contribution list; a future UI pass should make setup/payment collection a clearly separate, less prominent step without losing the ledger.
- Decide whether the one-time collection should be locked after recording, or remain editable for admin corrections/refunds. Current code does not lock it.
- Verify token quick action, contribution records, and mobile layout in a browser and on the live Cloudflare deployment.
- The live deployment has not been verified by this code change. No database schema or production financial records were changed.


## Setup-to-token workflow clarification — 12 Oct 2026

### Done in code
- Labeled **Step 1 — Setup and collection** for household member counting and contribution entry.
- Added explanatory copy: save each house's member count, calculate the due amount, and record the payment during collection.
- Labeled **Step 2 — Daily token workflow** for token assignment, waiting members, and today's receipt records.
- Contribution ledger now shows **Overpaid** and the extra amount when recorded payments exceed the household due amount. It does not carry the excess into a future season.

### Remaining
- The contribution form remains available to admins for corrections; it is not locked after the first payment.
- House-number cards still need their payment status to distinguish overpayment consistently.
- Test the whole flow with the real list before entering real production data. No production records were changed by this UI update.
- Browser, physical-phone, and Cloudflare deployment checks are still pending.


## Form input semantics and mobile styling — 12 Oct 2026

### Done in code
- Added explicit text input types to free-text fields such as notice titles, names, member labels, and expense descriptions.
- Kept amounts and contribution rates as decimal-capable number inputs, with decimal input hints.
- Kept member counts and token counts as integer number inputs with numeric keyboard hints and whole-number steps.
- Kept phone numbers as telephone inputs, dates as date inputs, passwords as password inputs, and the checkbox as a checkbox.
- Improved field labels, placeholder contrast, focus rings, disabled states, spacing, and phone-sized input height; preserved 16px text sizing on mobile to reduce browser zoom.
- Added email input-mode and capitalization/spellcheck hints to the mixed house-number/email login field.

### Still to verify
- Inspect every form in a browser, including custom mobile dropdowns, Gujarati labels, keyboard behavior, and validation.
- Confirm no numeric values are accidentally accepted as fractional member/token counts.
- Check the live Cloudflare deployment; the commit is in GitHub but live behavior is not verified.


## Festival flow decluttering — 12 Oct 2026

### Done in code
- Removed repeated explanatory paragraphs from the festival header, household setup, and daily token workspace.
- Removed redundant helper text from the waiting-member list while keeping the member labels and all token actions intact.
- Kept contribution totals, household member/due cards, payment ledger and entry form, daily token counts, waiting list, token records, and expense entry available.

### Still to verify
- Review the Navratri screen on a phone and confirm the shorter flow is easier to scan.
- Verify the latest commit has deployed to Cloudflare; browser and live deployment checks have not been performed.
- This was a presentation-only change; no database or financial records were changed.


## Festival house-number quick selector — 12 Oct 2026

### Done in code
- Added a compact 31–49 number-button selector above the household cards.
- Tapping a house number opens that household's existing details sheet, where the participant count and calculated contribution can be reviewed/edited by an admin.
- Reused the existing household-detail action so the selector and house cards behave consistently.

### Still to verify
- Test every house number and confirm the matching household opens, especially on phone-sized screens.
- Verify the latest GitHub commit has deployed to Cloudflare; live deployment and browser testing are not yet confirmed.
- No database or financial records were changed.


## Hide per-house payment-entry list — 12 Oct 2026

- [x] Hid the repeated per-house amount/payment-method entry cards marked for removal in the screenshot.
- [x] Kept the household member selector, calculated dues, payment summary totals, and daily token workflow visible.
- [x] This is a presentation-only change; existing contribution history and database records are preserved.
- [ ] Verify the live deployment and festival screen in a browser/phone; not yet confirmed.


## Festival day-by-day token controls — 12 Oct 2026

### Done in code
- Added a date picker constrained to the active festival dates in the daily token desk.
- Daily received/waiting summaries and token lists now filter by the selected festival date, rather than always showing today.
- Added green/red receipt indicators on house-number buttons for the selected date.
- Added an admin-only **Undo / remove** action on token records, with a confirmation prompt; this deletes only the selected token record so an accidental entry can be corrected.
- Kept the selected date when the view refreshes and use it for new token assignments.

### Still to verify
- Confirm database RLS allows admin deletion of token rows; if not, use a safe status/correction approach or update the policy deliberately.
- Test date changes, day summaries, dots, token creation, receipt updates, and undo in browser and on phone.
- Confirm live Cloudflare deployment. These checks have not been performed yet.
- No production token records were modified as part of this code change.


## Household-level token collection — 12 Oct 2026

- [x] Replaced one waiting row per individual placeholder with one row per house, showing the number of tokens still needed for that household.
- [x] Added **Mark all received (N)** to record the remaining household token count in one action, for example House 35 can collect all 6 members' tokens together.
- [x] Changing the house in the assignment form auto-fills a household label and the saved member count as the token count.
- [ ] Verify mixed prior individual records reconcile correctly with household-level counts and that a household cannot be over-counted.
- [ ] Test on browser/phone and confirm Cloudflare deployment. No existing token records were changed by this UI update.


## Navratri flow bug-fix pass — 12 Oct 2026

### Fixed in code
- **Daily expenses panel and token records list never appeared.** A `||` inside the long HTML string concatenation bound looser than `+`, so everything after the waiting list was dropped. The view is now built from separate section strings.
- **Admins could not record contributions.** The per-house payment list had been hidden with CSS. Payments are now recorded from the house sheet (tap a house), which also shows that house's payment history and pre-fills the outstanding amount.
- **Double taps recorded twice** (season, payment, token, expense). Submit buttons are disabled while a write is in flight.
- **Pending contributions was understated** when one house overpaid; it is now summed per house.
- Houses with 0 members showed **Paid**; they now show **Not participating**. Partial payments show **Partly paid**.
- **Token day defaulted to today even outside the festival**, so tokens could be saved on non-festival dates. The day is clamped to the season dates.
- **"Mark all received" could over-count** a household that already had pending token records. It now completes those records and adds only the remainder; manual assignment beyond the member count asks for confirmation.
- **House selector / Quick token did not update the custom picker label** and pre-filled 1 token. It now dispatches `change`, so the label and the remaining-token count stay in sync.
- **Changing the rate overwrote member counts** with the values loaded on screen. It now updates only the rate column.
- **Closed seasons were a dead end.** Admins can now create the next season or reopen the closed one; closed seasons are read-only.
- **Residents saw ₹0 expenses and a misleading balance** (they cannot read expense rows). Residents now see their own due / paid / pending, and house cards are not tappable for them.
- Season creation validates end ≥ start and repairs a missing house list on the next load.
- Contributions and tokens are queried for this season/day only (no silent 300-row truncation); the unused admin phone-number query was removed.
- Festival dates no longer shift by a day in time zones west of UTC; amounts follow the selected language.

### Verified
- `tests/navratri/e2e.mjs` drives admin and resident flows in headless Chromium against an in-memory mock (33 checks, 320px and 390px widths). This does **not** replace testing against the Supabase test project.

### Still open
- "Mark all received" is two writes (update + insert), not one transaction; a database RPC would make it atomic.
- The per-person rate still lives on every household row instead of on the season.
- Real sign-in, RLS row isolation and the live Cloudflare deployment are still unverified.


## Go-live SQL order (run in the Supabase SQL editor; test project first, then production)
1. *(Refunds need no SQL: production already has the `navratri_refunds` table, which the app now uses.)*
2. `docs/migrations/2026-10-13-programmes.sql` — programmes & expense sharing (**already applied to production**; only needed for any new project).
3. Create the Navratri season once in the app, then `docs/seed/navratri-2026-member-counts.sql` — real member counts (check readings for houses 39 and 43 first).
4. `docs/seed/test-project-cleanup.sql` — **test project only**, removes synthetic festival data.

## Automated checks
```bash
npm i --no-save playwright @electric-sql/pglite && npx playwright install chromium
node tests/navratri/e2e.mjs index.html /tmp     # browser flows against a mock database
node tests/programmes/sql-test.mjs              # programme SQL on an in-memory Postgres
```
