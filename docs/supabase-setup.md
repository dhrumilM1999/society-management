# Supabase setup — Sonalpark Society Gate-2

Project ref: `cfrvkrsqomtrgvejxeub`  
Project URL: `https://cfrvkrsqomtrgvejxeub.supabase.co`  
Houses seeded: **31 through 49 inclusive (19 houses)**.

## Current database

The initial schema and follow-up hardening migrations have been applied directly to the hosted project. Tables in `public` have Row Level Security (RLS) enabled. A security-advisor check returned no security findings. Performance advice currently reports unused indexes because the new database has not received normal application traffic; these are not errors.

## Create the first administrator

Do not enable public sign-up. Create the administrator manually:

1. Open the Supabase project dashboard and go to **Authentication → Users**.
2. Create a user with the administrator's email and a temporary strong password. Share that password securely and have them change it.
3. Copy the new user's UUID from Authentication → Users.
4. Open **SQL Editor** and run the following after replacing the two placeholders. Run this only as the project owner/admin in the SQL editor.

```sql
insert into public.profiles (id, display_name, role, house_number, preferred_language)
values ('PASTE_AUTH_USER_UUID_HERE', 'Society Administrator', 'admin', null, 'en');
```

The first administrator must be provisioned this way because the browser cannot promote itself to administrator. Never use user-editable auth metadata to assign roles.

## Add residents

For each house, create an Auth user in **Authentication → Users**, then add a profile through the SQL Editor. Replace the UUID, name, and house number (must be 31–49):

```sql
insert into public.profiles (id, display_name, role, house_number, preferred_language)
values ('PASTE_AUTH_USER_UUID_HERE', 'Resident name', 'resident', 31, 'gu');
```

A house can have at most one resident login in the current model. A resident cannot edit their role or house assignment through the application. Admins have no house number. If a resident login needs replacement, have the administrator update the profile carefully.

## Deployment and public client configuration

The `index.html` portal uses the Supabase URL and **publishable** key. Publishable keys are intended for browser clients; do not add a `service_role` or secret key to this repository.

The GitHub `main` branch was updated with the portal. If the deployed site is connected to this repository through Cloudflare's Git integration, it should automatically redeploy. Verify the deployment status and open the deployed URL to confirm.

## House-number login

The resident portal maps a house number such as `31` to an internal synthetic Auth email (`house31@sonalpark-gate2.invalid`) and still requires a password. Residents enter the house number, not this internal email. These synthetic addresses cannot receive email, so password resets must be handled by the administrator using **Manage houses** to set a new temporary password. Admins continue to sign in with their actual email address. The public directory shows only house numbers and active/inactive status; resident names and contact phones remain private.

## Current features in the portal

- Email/password sign-in (no public sign-up).
- English/Gujarati UI toggle.
- Published notices and meetings.
- Resident payment submissions; admin confirmation calls a database function that updates payment status, appends a ledger entry, and writes an audit entry atomically.
- Separate Maintenance, Festival, and General ledger categories.
- Programme and expense-share display, once programme data is entered.
- Admin review of pending payments and notice publishing.

## Testing status and limits

Verified against the live database:
- Exactly 19 house records exist, numbered 31–49.
- All 12 public tables have RLS enabled.
- The three expected accounting RPC wrappers exist.
- Immutable-ledger, immutable-audit, and profile-authorization triggers exist.
- Supabase security advisor returned no findings.

Not yet end-to-end tested:
- Real user sign-in and resident/admin policy separation, because no Auth users or profiles have been provisioned.
- Payment submission and confirmation with test accounts.
- Real email delivery, browser push, or WhatsApp integrations.
- Programme expense split finalization and automatic share calculations. The tables exist, but a dedicated atomic split-finalization workflow still needs implementation before these records should be used for real festival billing.

**Do not enter real financial records until the first admin and a test resident are provisioned and the payment workflow is exercised with a small test amount.** Use the rejection path to test a rejected payment, and verify that only approved payments create ledger entries.
