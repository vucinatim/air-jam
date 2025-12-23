---
description: How to deploy the Air Jam server to Railway
---

# Deploying Server to Railway

1.  **Preparation**
    *   Ensure you have pushed your latest code to GitHub.
    *   Have your `AIR_JAM_MASTER_KEY` and `DATABASE_URL` ready.

2.  **Create Project**
    *   Go to [Railway Dashboard](https://railway.app/dashboard).
    *   Click "New Project" -> "Deploy from GitHub repo".
    *   Select your Air Jam repository.

3.  **Configure Monorepo**
    *   Railway will likely detect multiple projects.
    *   Select **Add Service** (or click the repo card).
    *   Go to **Settings** -> **General** -> **Root Directory**.
    *   Set it to: `packages/server`.
    *   *This tells Railway to only look at the server package for this service.*

4.  **Configure Variables**
    *   Go to the **Variables** tab.
    *   Add:
        *   `AIR_JAM_MASTER_KEY`: (Your generated key)
        *   `DATABASE_URL`: (Your database connection string)
        *   `PORT`: `4000` (Optional, Railway often sets `PORT` automatically, but setting it ensures match with code).

5.  **Build Command (Important)**
    *   Go to **Settings** -> **Build**.
    *   Since this is a monorepo using `pnpm`, we need to make sure it installs workspace dependencies.
    *   **Build Command**: `pnpm install && pnpm build` (This runs the build script in `packages/server/package.json` which runs `tsc`).
    *   *Note: Railway's Nixpacks usually handles this automatically if it detects `package.json`, but if it fails, verify this.*

6.  **Start Command**
    *   **Start Command**: `pnpm start` (This runs `node dist/index.js` as we configured).

7.  **Generate Domain**
    *   Go to **Settings** -> **Networking**.
    *   Click "Generate Domain" (you will get something like `server-production.up.railway.app`).
    *   This is the URL you will put in your Platform's `.env` as `NEXT_PUBLIC_SERVER_URL` (with `https://`).

8.  **Deploy**
    *   The first deploy usually happens automatically. If it failed due to missing vars, click "Redeploy".
