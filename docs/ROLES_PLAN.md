# Roles & shared contacts — plan (not yet built)

Requested 13 Oct 2026. Everything must be done from the website; nobody edits the database by hand.

## Roles
| Role | Can do |
|---|---|
| **Super admin** | See and do everything. Create / remove admins, change roles, reset any password, permanent deletes. |
| **Admin** | Manage day-to-day: houses and residents, festival (collection, tokens, expenses), programmes, payments review, notices, share information with users. Cannot create/remove admins or change roles, cannot delete things permanently. |
| **User (resident)** | See what is going on. Manage own house details: name, phone, language, password, festival member count. Cannot change house number or role. |

Decisions already made: the current admin account becomes the super admin; the existing `admin` role stays so every current policy keeps working, and super admin is an extra flag on top of it.

## Shared contacts (new)
Owner/admins publish useful numbers for everyone (plumber, mistri/mason, electrician, election office, etc.) — name, category, phone, optional note; all users can view and tap to call.

## What is already live
- **My account** (everyone): edit own name, phone, language and change own password. Works with no backend change.

## What needs ONE backend change (cannot be done from the website itself)
The website can never alter its own database (that would let anyone abuse it). The pieces below need SQL / an Edge Function applied once by whoever has Supabase access — either the owner pasting one file, or the assistant through the Supabase connector:
- `profiles.is_super` flag + protection so nobody can promote themselves.
- Database rules for admin vs super admin (e.g. only super admin can add/remove admins or delete).
- Edge Function to create/remove admin accounts and reset passwords from the site.
- A `contacts` table (+ rules) for the shared contacts directory.
- Letting a user update their own member count for the festival.
Once Supabase access is available, these are built together, tested on an in-memory Postgres first (as done for Programmes), and applied.
