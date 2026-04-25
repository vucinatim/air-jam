import { describe, expect, it } from "vitest";
import {
  AIRJAM_STORE_DOMAIN_URL_PARAM,
  embeddedReplicatedStoreDomainFromArcadeIdentity,
  resolveImplicitReplicatedStoreDomainFromSearchParams,
} from "../src/runtime/arcade-runtime-url";
import { AIR_JAM_DEFAULT_STORE_DOMAIN } from "../src/store/air-jam-store-domain-constants";

describe("arcade runtime URL / implicit store domain", () => {
  it("derives embedded domain from arcade game identity", () => {
    expect(
      embeddedReplicatedStoreDomainFromArcadeIdentity({
        epoch: 2,
        kind: "game",
        gameId: "pong",
      }),
    ).toBe("aj.embedded.game:2:pong");
  });

  it("derives embedded domain for browser surface", () => {
    expect(
      embeddedReplicatedStoreDomainFromArcadeIdentity({
        epoch: 4,
        kind: "browser",
        gameId: null,
      }),
    ).toBe("aj.embedded.browser:4");
  });

  it("prefers aj_store_domain when present", () => {
    const params = new URLSearchParams(
      `${AIRJAM_STORE_DOMAIN_URL_PARAM}=custom.domain&aj_arcade_epoch=1&aj_arcade_kind=game&aj_arcade_game_id=x`,
    );
    expect(resolveImplicitReplicatedStoreDomainFromSearchParams(params)).toBe(
      "custom.domain",
    );
  });

  it("derives from aj_arcade_* when aj_store_domain absent", () => {
    const params = new URLSearchParams(
      "aj_arcade_epoch=1&aj_arcade_kind=game&aj_arcade_game_id=alpha",
    );
    expect(resolveImplicitReplicatedStoreDomainFromSearchParams(params)).toBe(
      "aj.embedded.game:1:alpha",
    );
  });

  it("falls back to default when no arcade context", () => {
    expect(
      resolveImplicitReplicatedStoreDomainFromSearchParams(
        new URLSearchParams(""),
      ),
    ).toBe(AIR_JAM_DEFAULT_STORE_DOMAIN);
  });
});
