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

7.  **Configure Custom Domain (Recommended)**
    *   Go to **Settings** -> **Networking**.
    *   Click **Custom Domain** and enter: `api.air-jam.app`
    *   Railway will show you DNS verification details (usually a CNAME record pointing to the Railway domain).
    *   Add the CNAME record in your DNS provider (Namecheap, Cloudflare, etc.).
    *   Once verified, your server will be accessible at `https://api.air-jam.app`.
    *   
    *   **Alternative:** If you don't want to use a custom domain, click "Generate Domain" to get a Railway domain like `server-production-xxxx.up.railway.app`.

8.  **Configure Platform Environment Variables**
    *   In your Platform's environment variables (Vercel or wherever it's deployed), set:
    *   `NEXT_PUBLIC_AIR_JAM_SERVER_URL=https://api.air-jam.app` (or your Railway domain if not using custom domain)

9.  **Deploy**
    *   The first deploy usually happens automatically. If it failed due to missing vars, click "Redeploy".
