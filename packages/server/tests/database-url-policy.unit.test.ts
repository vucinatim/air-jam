import { describe, expect, it } from "vitest";
import {
  isLocalDatabaseUrl,
  resolveServerRuntimeDatabaseUrl,
} from "../src/env/database-url-policy";

describe("resolveServerRuntimeDatabaseUrl", () => {
  it("accepts local postgres urls by default", () => {
    expect(
      resolveServerRuntimeDatabaseUrl({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:55432/airjam",
      }),
    ).toEqual({
      databaseUrl: "postgresql://postgres:postgres@127.0.0.1:55432/airjam",
      remoteDatabaseBlocked: false,
    });
  });

  it("blocks remote postgres urls outside production by default", () => {
    expect(
      resolveServerRuntimeDatabaseUrl({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@db.example.com:5432/airjam",
      }),
    ).toEqual({
      remoteDatabaseBlocked: true,
    });
  });

  it("allows remote postgres urls when explicitly enabled", () => {
    expect(
      resolveServerRuntimeDatabaseUrl({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@db.example.com:5432/airjam",
        AIR_JAM_ALLOW_REMOTE_DATABASE: "enabled",
      }),
    ).toEqual({
      databaseUrl: "postgresql://user:pass@db.example.com:5432/airjam",
      remoteDatabaseBlocked: false,
    });
  });

  it("allows remote postgres urls in production", () => {
    expect(
      resolveServerRuntimeDatabaseUrl({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@db.example.com:5432/airjam",
      }),
    ).toEqual({
      databaseUrl: "postgresql://user:pass@db.example.com:5432/airjam",
      remoteDatabaseBlocked: false,
    });
  });
});

describe("isLocalDatabaseUrl", () => {
  it("treats localhost-style urls as local", () => {
    expect(
      isLocalDatabaseUrl("postgresql://postgres@localhost:5432/airjam"),
    ).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://postgres@[::1]:5432/airjam")).toBe(
      true,
    );
  });

  it("treats non-local hosts as remote", () => {
    expect(
      isLocalDatabaseUrl("postgresql://postgres@db.example.com:5432/airjam"),
    ).toBe(false);
  });
});
