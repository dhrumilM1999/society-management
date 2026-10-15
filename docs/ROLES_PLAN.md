# Roles, shared contacts and member self-service

Requested 13 Oct 2026, built 15 Oct 2026. Everything is done from the website; nobody edits the database by hand.

## The three roles
| Role | Who | Can do |
|---|---|---|
| **Super admin** | the current "Society Administrator" account (promoted automatically by the migration) | Everything. Also: add admins, deactivate / reactivate admins, grant or remove super-admin status, reset admin passwords, and **permanently delete** payments, refunds, seasons, households, notices, meetings, maintenance charges. |
| **Admin** | any other admin account | Runs the society day to day: houses & residents, festival (collection, tokens, expenses), programmes, payment review, notices, shared contacts. Can record and correct but **cannot** delete payments/refunds/seasons/notices for good, **cannot** touch other admin accounts or roles. Can still remove a mistaken token, a mistaken daily expense and draft programmes. |
| **User (resident)** | house logins | See what is going on. In *My account*: edit own name, phone, language, change own password, and set the number of festival members for their house (only before a payment or token exists). Cannot change house number or role. |

"Removing" an admin means **deactivating** the account: it keeps all history, blocks sign-in, removes admin power instantly and can be reversed. (The database forces admins to have no house, so an admin cannot be turned into a resident.)

## What is built
| Piece | File | Status |
|---|---|---|
| Database: `is_super` / `is_active` flags, stricter rules, `useful_contacts`, resident member-count function | `docs/migrations/2026-10-15-roles-and-contacts.sql` | Written and tested on a replica of production's rules (56 checks). **NOT yet applied to production — waiting for owner approval.** |
| Server function to add/deactivate admins, grant super, reset passwords | `supabase/functions/manage-admins/index.ts` | Written and tested with a fake Supabase (40 checks). **NOT yet deployed — waiting for owner approval.** |
| Website: Useful contacts, Team & roles, My account (+ member count), role labels | `index.html` | Live. Each screen shows a friendly "not switched on yet" message until the matching database/server piece exists, so nothing breaks in the meantime. |

## To switch it on (owner approval needed)
1. Apply `2026-10-15-roles-and-contacts.sql` to production.
2. Deploy the `manage-admins` Edge Function (Supabase dashboard → Edge Functions, or CLI).
3. Sign in as the super admin and check *Team & roles*; add a normal admin and confirm they cannot see *Team & roles* nor delete a payment.

## Safety design (why this is safe on live data)
- Built on production's existing helpers: `app_private.is_admin()`, the profile-protection trigger and `audit_log`.
- `is_active` defaults to true, `is_super` to false (the one existing admin is promoted), so nothing changes for today's single admin.
- Role changes are blocked in the database itself (trigger), not only hidden in the website.
- Server-only actions (create admin, reset password) use the service key inside an Edge Function that first verifies the caller is an active super admin; every action is written to `audit_log` (passwords never are).
- The migration is idempotent and the policy swap is atomic (single transaction).
