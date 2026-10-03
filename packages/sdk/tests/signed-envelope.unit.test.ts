import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createSignedEnvelope,
  verifySignedEnvelope,
  type SignedEnvelopeContract,
} from "../src/protocol/signed-envelope";

const claimsSchema = z
  .object({
    typ: z.literal("test.capability.v1"),
    jti: z.string().uuid(),
  })
  .strict();
type Claims = z.infer<typeof claimsSchema>;

const contract = (signingDomain: string): SignedEnvelopeContract<Claims> => ({
  signingDomain,
  claimsSchema,
});

describe("signed envelope", () => {
  it("round-trips schema-validated claims in browser-compatible globals", async () => {
    const claims: Claims = {
      typ: "test.capability.v1",
      jti: "11111111-1111-4111-8111-111111111111",
    };
    const issued = await createSignedEnvelope({
      secret: "signed-envelope-secret",
      claims,
      contract: contract("airjam:test:one:v1"),
    });

    await expect(
      verifySignedEnvelope({
        secret: "signed-envelope-secret",
        token: issued.token,
        contract: contract("airjam:test:one:v1"),
      }),
    ).resolves.toEqual({ ok: true, claims });
  });

  it("domain-separates capabilities signed by the same root secret", async () => {
    const issued = await createSignedEnvelope({
      secret: "shared-root-secret",
      claims: {
        typ: "test.capability.v1",
        jti: "11111111-1111-4111-8111-111111111111",
      },
      contract: contract("airjam:test:one:v1"),
    });

    await expect(
      verifySignedEnvelope({
        secret: "shared-root-secret",
        token: issued.token,
        contract: contract("airjam:test:two:v1"),
      }),
    ).resolves.toEqual({ ok: false, error: "invalid_signature" });
  });

  it("rejects claims outside the contract before signing", async () => {
    await expect(
      createSignedEnvelope({
        secret: "signed-envelope-secret",
        claims: {
          typ: "test.capability.v1",
          jti: "11111111-1111-4111-8111-111111111111",
          obsolete: true,
        } as unknown as Claims,
        contract: contract("airjam:test:one:v1"),
      }),
    ).rejects.toThrow();
  });
});
