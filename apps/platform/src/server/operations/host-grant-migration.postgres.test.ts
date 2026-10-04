import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createHash, randomUUID } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

const databaseUrl = process.env.AIR_JAM_TEST_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl ? describe : describe.skip;
const migrationsRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../drizzle",
);

describeWithPostgres("host grant migration history", () => {
  for (const priorHead of [39, 40]) {
    it(`upgrades applied history through ${priorHead} without rewriting it`, async () => {
      if (!databaseUrl)
        throw new Error("An isolated test database is required.");
      const sourceUrl = new URL(databaseUrl);
      const adminUrl = new URL(sourceUrl);
      adminUrl.pathname = "/postgres";
      const databaseName = `airjam_host_migration_${randomUUID().replaceAll("-", "")}`;
      const targetUrl = new URL(sourceUrl);
      targetUrl.pathname = `/${databaseName}`;
      const catalogRoot = mkdtempSync(
        path.join(tmpdir(), "airjam-host-history-"),
      );
      const admin = postgres(adminUrl.toString(), {
        max: 1,
        onnotice: () => undefined,
      });
      let target: ReturnType<typeof postgres> | undefined;
      try {
        mkdirSync(path.join(catalogRoot, "meta"));
        const journal = JSON.parse(
          readFileSync(path.join(migrationsRoot, "meta/_journal.json"), "utf8"),
        ) as { entries: Array<{ idx: number; tag: string }> };
        const entries = journal.entries.filter(
          (entry) => entry.idx <= priorHead,
        );
        writeFileSync(
          path.join(catalogRoot, "meta/_journal.json"),
          JSON.stringify({ ...journal, entries }),
        );
        for (const entry of entries) {
          copyFileSync(
            path.join(migrationsRoot, `${entry.tag}.sql`),
            path.join(catalogRoot, `${entry.tag}.sql`),
          );
        }
        await admin.unsafe(`create database "${databaseName}"`);
        target = postgres(targetUrl.toString(), {
          max: 1,
          onnotice: () => undefined,
        });
        await migrate(drizzle(target), { migrationsFolder: catalogRoot });
        const before =
          await target`select hash, created_at from drizzle.__drizzle_migrations order by id`;
        if (priorHead === 40) {
          expect(before.at(-1)?.hash).toBe(
            "f8b2cd744cfaa64055fa79dc0ba7972757466b7a47729f798a12715e85bec7e7",
          );
        }
        await migrate(drizzle(target), { migrationsFolder: migrationsRoot });
        const after =
          await target`select hash, created_at from drizzle.__drizzle_migrations order by id`;
        expect(after.slice(0, before.length)).toEqual(before);
        expect(after).toHaveLength(journal.entries.length);
        expect(after.at(-1)?.hash).toBe(
          createHash("sha256")
            .update(
              readFileSync(
                path.join(
                  migrationsRoot,
                  "0044_release_report_submission_keys.sql",
                ),
              ),
            )
            .digest("hex"),
        );
        const [constraint] = await target`
          select exists (
            select 1 from pg_constraint
            where conrelid = 'realtime_host_grant_consumptions'::regclass
              and conname = 'realtime_host_grant_consumptions_chronology_check'
          ) as exists
        `;
        expect(constraint?.exists).toBe(false);
        await target`
          insert into realtime_host_grant_consumptions (jti, app_id, session_kind, expires_at)
          values ('clock-proof', 'test-game', 'game', now() - interval '1 second')
        `;
        const [columns] = await target`
          select count(*)::integer as count from information_schema.columns
          where table_schema = 'public' and table_name = 'game_release_reports'
            and column_name in ('review_revision', 'submission_id')
        `;
        expect(columns?.count).toBe(2);
      } finally {
        await target?.end();
        await admin.unsafe(`drop database if exists "${databaseName}"`);
        await admin.end();
        rmSync(catalogRoot, { recursive: true, force: true });
      }
    });
  }
});
