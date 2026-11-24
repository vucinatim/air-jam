import { expect, it } from "vitest";
import { resolvePhoneJoinUrl } from "../src/core/phone-join-url";

it("has no phone join URL when no public address is supplied", () => {
  expect(resolvePhoneJoinUrl(undefined)).toBeNull();
});

it("has no phone join URL for loopback addresses", () => {
  for (const hostname of [
    "127.0.0.1",
    "127.42.0.7",
    "[::1]",
    "localhost",
    "game.localhost",
  ]) {
    expect(
      resolvePhoneJoinUrl(`http://${hostname}:3000/controller?room=ABCD`),
    ).toBeNull();
  }
});

it("preserves a LAN join URL including its room and controller capability", () => {
  const value =
    "http://192.168.1.20:3000/controller?room=ABCD&aj_controller_cap=secret";
  expect(resolvePhoneJoinUrl(value)).toBe(value);
});
