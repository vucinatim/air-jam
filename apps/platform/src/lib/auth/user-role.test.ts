import { describe, expect, it } from "vitest";
import { isOpsAdmin, userRoleSchema } from "./user-role";

describe("user role contract", () => {
  it("treats only ops_admin as internal ops access", () => {
    expect(isOpsAdmin("ops_admin")).toBe(true);
    expect(isOpsAdmin("creator")).toBe(false);
  });

  it("parses only supported role values", () => {
    expect(userRoleSchema.parse("creator")).toBe("creator");
    expect(userRoleSchema.parse("ops_admin")).toBe("ops_admin");
    expect(() => userRoleSchema.parse("admin")).toThrow();
  });
});
