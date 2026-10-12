# Navratri browser checks

Runs `index.html` in headless Chromium against an in-memory Supabase stand-in
(`mock-supabase.js`), so no real project or data is touched. The mock imitates
resident RLS (own house only, no expense reads) but it is **not** a substitute for
testing against the Supabase test project.

```bash
npm i --no-save playwright && npx playwright install chromium
node tests/navratri/e2e.mjs            # prints PASS/FAIL per check, screenshots go to /tmp
```
