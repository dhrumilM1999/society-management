# Society Management — Coming Soon

A minimal, responsive coming-soon page for the society management portal. The first release is plain static HTML/CSS/JavaScript so it can be published without installing dependencies. The React/Vite application can be introduced when feature development begins.

## Preview locally

Open `index.html` in a browser, or run a local static server:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000.

## Deploy to Cloudflare Pages with Git integration

This repository is configured as a static HTML site. In the Cloudflare dashboard:

1. Open **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Connect GitHub and choose `dhrumilM1999/society-management`.
3. Set the production branch to `main`.
4. Leave the framework preset as **None** / **No framework**.
5. Build command: `exit 0` (or leave it blank if Cloudflare allows it).
6. Build output directory: `.` (repository root, where `index.html` lives).
7. Select **Save and Deploy**.

Cloudflare will provide a `*.pages.dev` URL when the deployment succeeds. Confirm the deployment status is **Success** and open that URL to verify the page. Future commits to `main` deploy automatically after Git integration is connected.

Official guide: https://developers.cloudflare.com/pages/framework-guides/deploy-anything/

## Files

- `index.html` — responsive Coming Soon landing page.
- `_headers` — basic browser security headers for Cloudflare Pages.

## Important

This is only a public landing page, not the resident management application. Authentication, resident data, billing, and fund accounting have not been implemented. Do not add private resident information or credentials to this repository. Supabase and any production secrets should be configured separately when those features are developed.
