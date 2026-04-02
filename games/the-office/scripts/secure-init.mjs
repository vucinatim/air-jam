#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function usage() {
  console.log(
    "Usage: pnpm run secure:init -- --hostname <dev.yourdomain.com> --tunnel <tunnel-name>",
  );
}

function parseArgs(argv) {
  const args = { hostname: "", tunnel: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--hostname") args.hostname = argv[i + 1] || "";
    if (token === "--tunnel") args.tunnel = argv[i + 1] || "";
  }
  return args;
}

function run(command, options = {}) {
  return execSync(command, {
    stdio: options.silent ? "pipe" : "inherit",
    encoding: "utf8",
  });
}

function upsertEnv(filePath, key, value) {
  let content = "";
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, "utf8");
  }

  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(content)) {
    content = content.replace(pattern, line);
  } else {
    content += `${content.endsWith("\n") || content.length === 0 ? "" : "\n"}${line}\n`;
  }

  fs.writeFileSync(filePath, content);
}

async function main() {
  const { hostname, tunnel } = parseArgs(process.argv.slice(2));
  if (!hostname || !tunnel) {
    usage();
    process.exit(1);
  }

  const certPath = path.join(
    process.env.HOME || "",
    ".cloudflared",
    "cert.pem",
  );
  if (!fs.existsSync(certPath)) {
    console.error("Cloudflare login not found. Run: cloudflared tunnel login");
    process.exit(1);
  }

  try {
    run("pnpm exec cloudflared --version", { silent: true });
  } catch {
    console.error("cloudflared is required. Install it or run pnpm install.");
    process.exit(1);
  }

  let tunnelExists = false;
  try {
    run(`pnpm exec cloudflared tunnel info ${tunnel}`, { silent: true });
    tunnelExists = true;
  } catch {
    tunnelExists = false;
  }

  if (!tunnelExists) {
    console.log(`Creating tunnel ${tunnel}...`);
    run(`pnpm exec cloudflared tunnel create ${tunnel}`);
  } else {
    console.log(`Tunnel ${tunnel} already exists, reusing it.`);
  }

  console.log(`Routing DNS ${hostname} -> ${tunnel}...`);
  run(`pnpm exec cloudflared tunnel route dns ${tunnel} ${hostname}`);

  const tunnelInfoRaw = run(`pnpm exec cloudflared tunnel info ${tunnel}`, {
    silent: true,
  });
  const idMatch = tunnelInfoRaw.match(/[0-9a-f-]{36}/i);
  if (!idMatch) {
    throw new Error(
      "Could not resolve tunnel UUID from `cloudflared tunnel info`.",
    );
  }
  const tunnelId = idMatch[0];
  const credentialsFile = path.join(
    process.env.HOME || "",
    ".cloudflared",
    `${tunnelId}.json`,
  );

  fs.mkdirSync(".cloudflared", { recursive: true });
  fs.writeFileSync(
    ".cloudflared/config.yml",
    [
      `tunnel: ${tunnel}`,
      `credentials-file: ${credentialsFile}`,
      "",
      "ingress:",
      `  - hostname: ${hostname}`,
      "    service: http://127.0.0.1:5173",
      "  - service: http_status:404",
      "",
    ].join("\n"),
    "utf8",
  );

  const publicHost = `https://${hostname}`;
  upsertEnv(".env.local", "AIR_JAM_SECURE_PUBLIC_HOST", publicHost);
  upsertEnv(".env.local", "CLOUDFLARE_TUNNEL_NAME", tunnel);

  console.log("\nSecure dev setup complete.");
  console.log(`Public host: ${publicHost}`);
  console.log(`Tunnel: ${tunnel}`);
  console.log("Next: pnpm run dev:secure");
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
