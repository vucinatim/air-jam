import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLaunchDatabase } from "../scripts/launch-load/fixture.js";

const mocks = vi.hoisted(() => ({ createDatabase: vi.fn() }));
vi.mock("./helpers/postgres-fixture.js", () => ({
  createDisposablePostgresDatabase: mocks.createDatabase,
}));

describe("launch-load fixture seeds", () => {
  beforeEach(() => vi.resetAllMocks());

  const prepareFixture = () => {
    const observer = vi.fn(
      async (_strings: TemplateStringsArray, ..._values: unknown[]) => [],
    );
    const fixture = {
      name: "airjam_test_0123456789abcdef0123456789abcdef",
      url: new URL(
        "postgres://localhost/airjam_test_0123456789abcdef0123456789abcdef",
      ),
      observer,
      cleanup: vi.fn(async () => undefined),
    };
    mocks.createDatabase.mockResolvedValueOnce(fixture);
    return fixture;
  };

  it("seeds only the load rehearsal with twelve creators/games/apps and budget authority", async () => {
    const fixture = prepareFixture();
    const base = new URL("postgres://localhost/development");
    const result = await createLaunchDatabase(base, "load-run");
    expect(mocks.createDatabase).toHaveBeenCalledExactlyOnceWith(
      base,
      "load-run",
    );
    expect(result.apps).toHaveLength(12);
    expect(new Set(result.apps).size).toBe(12);
    expect(result.observer).toBe(fixture.observer);
    expect(result.cleanup).toBe(fixture.cleanup);
    const statements = fixture.observer.mock.calls.map(([strings]) =>
      strings.join("?"),
    );
    for (const table of ["users", "games", "app_ids"]) {
      expect(
        statements.filter((statement) =>
          statement.startsWith(`insert into ${table}(`),
        ),
      ).toHaveLength(12);
    }
    for (const table of [
      "operational_budget_cycles",
      "operational_budget_evidence",
    ]) {
      expect(
        statements.filter((statement) =>
          statement.startsWith(`insert into ${table}(`),
        ),
      ).toHaveLength(1);
    }
    expect(fixture.cleanup).not.toHaveBeenCalled();
  });

  it("disposes the generated database when seeding fails", async () => {
    const fixture = prepareFixture();
    const failure = new Error("seed failed");
    fixture.observer.mockRejectedValueOnce(failure);
    await expect(
      createLaunchDatabase(
        new URL("postgres://localhost/development"),
        "load-run",
      ),
    ).rejects.toBe(failure);
    expect(fixture.cleanup).toHaveBeenCalledOnce();
  });
});
