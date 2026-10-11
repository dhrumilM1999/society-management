# Sonalpark Society Gate-2 — Workflow Plan

**Scope:** Houses 31–49 (19 homes)  
**Design reference:** [Refero Styles](https://styles.refero.design/)  
**Priority:** Mobile-first; admin workflow should be comfortable on a phone.

## Goal

Keep the festival workflow simple. Count household members and record the household contribution during setup. Once that is done, the repeated daily task should be token assignment and token-receipt tracking—not repeatedly entering cash.

## Intended workflow

1. **Choose the active festival season.**
2. **Set household member count** for each house (31–49).
3. **Calculate contribution automatically** using the shared per-person rate.
4. **Record collection once** when the household contribution is collected. Preserve the payment history for audit and correction.
5. **Daily token work:** open a house, use **Quick token**, assign token(s), then mark received when the member collects them.
6. **Review who is waiting** and today's token records.

## Mobile UI/UX plan

### Primary daily screen
- Put the token summary and token assignment workflow first.
- Make the house number the main tap target.
- Keep one obvious house-level action: **Quick token**.
- Keep the waiting list and today's token status easy to scan.
- Use large tap targets, readable status labels, minimal typing, and a fixed bottom navigation.
- Follow Refero's restrained editorial style: white canvas, dark ink, quiet borders, serif display headings, and compact pill actions.

### Setup and collection
- Treat member counting and contribution collection as setup tasks, not the daily focus.
- Keep member count and automatically calculated due amount together.
- Keep payment entry and the contribution ledger available to admins, but visually separate them from the daily token flow.
- Never delete or overwrite payment records when changing the UI.
- Show underpayment, exact payment, and overpayment distinctly in the future accounting pass; never silently treat an overpayment as future credit without an explicit society decision.

### Token workflow
- Selecting **Quick token** should preselect the house in the token form.
- Minimize repeated typing; use the saved participant count and clear member labels.
- Show the difference between **Waiting**, **Received**, and **Pending record** unambiguously.
- Do not treat generated placeholder labels such as “Member 1” as verified names.
- Keep call/WhatsApp actions optional and only use an authorized, saved phone number. WhatsApp remains user-initiated unless an approved integration is added.

## Implemented so far

- [x] Houses 31–49 are shown as house-number cards.
- [x] Admin can edit household participant count.
- [x] Household due amount is calculated from participant count × shared rate.
- [x] Admin can record contributions and view the contribution ledger.
- [x] Daily token assignment form exists.
- [x] House-level **Quick token** action preselects the house in the token form.
- [x] Waiting list is generated from the saved participant count.
- [x] Admin can mark generated or listed token records as received.
- [x] Removed the per-house **Receive money** shortcut from the house grid so the repeated daily action stays token-focused.
- [x] README status updated to reflect this iteration.

## Remaining work

### Priority 1 — UI workflow
- [ ] Consider moving the daily token desk above setup/collection if the owner wants token-first screen order; current workflow labels the setup step first and daily token step second.
- [ ] Make household setup/payment collection collapsible or otherwise less prominent after initial setup, without hiding corrections or the ledger.
- [ ] Consider a one-time collection completion indicator per house without locking legitimate admin corrections.
- [ ] Ensure the Quick token action leads to a clear, focused token-entry state on small screens.
- [ ] Make payment status explicitly distinguish **Pending**, **Paid**, and **Overpaid**; display the excess amount without automatically carrying it forward.

### Priority 2 — correctness and safety
- [ ] Verify token-count logic against real intended usage: people, token units, or token bundles.
- [ ] Prevent duplicate “received” records when an admin taps twice or reloads during submission.
- [ ] Confirm generated member placeholders cannot accidentally imply real identities.
- [ ] Reconcile each house's due, paid, outstanding, and overpaid amounts against contribution records.
- [ ] Confirm resident sessions cannot access admin-only contact, expense, or collection data.

### Priority 3 — verification and deployment
- [ ] Test admin and resident login against the test project.
- [ ] Test RLS row isolation with authenticated sessions.
- [ ] Test all forms and totals at 320px, 360px, 390px, and 430px viewport widths.
- [ ] Test on a physical phone, including keyboard, scrolling, safe areas, and Gujarati text.
- [ ] Confirm the GitHub commit is deployed to Cloudflare and smoke-test the live site.
- [ ] Do not use real festival transactions until permissions, totals, and fund separation have been verified.

## Current status snapshot

| Area | Status |
|---|---|
| House/member setup | Implemented in code; needs verification |
| Shared per-person rate | Implemented in UI; rate is stored on household rows rather than once per season |
| Contribution entry and ledger | Implemented; labeled as setup/collection step, not locked |
| Quick token action | Implemented; house is preselected |
| Waiting/received list | Implemented with generated placeholder labels; logic needs testing |
| Overpayment display | Household ledger distinguishes overpaid amount in UI; house-card status still needs consistency pass |
| Mobile-first styling | Implemented in CSS; physical-device verification pending |
| Test-project authenticated checks | Pending |
| Live Cloudflare verification | Pending |

## Guardrails

- Do not delete existing payment or token records just to simplify the interface.
- Do not automatically apply overpayment to a future season unless the society explicitly chooses that accounting rule.
- Do not claim browser, physical-phone, RLS, or deployment tests are complete until they are actually run.
- Keep the Refero Styles reference as the default design reference unless the owner changes it.


## Workflow clarification — 12 Oct 2026

- [x] Labeled household member count and money collection as **Step 1 — Setup and collection**.
- [x] Explained that each household payment should be recorded during setup/collection and daily work should then use the token desk.
- [x] Labeled token assignment, waiting list, and receipt tracking as **Step 2 — Daily token workflow**.
- [x] Contribution ledger now labels an overpayment and shows the excess amount instead of calling it simply paid.
- [ ] Payment form remains available; the interface does not technically lock a household after its first payment. Keep admin corrections possible.
- [ ] Review status display on the house-number cards so it also distinguishes overpayment.
- [ ] Verify the flow and totals with the real house/member list before marking the festival as initialized.
