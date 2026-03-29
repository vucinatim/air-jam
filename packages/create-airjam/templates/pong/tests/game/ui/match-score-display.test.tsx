import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MatchScoreDisplay, TeamName } from "../../../src/game/ui";

describe("shared game ui", () => {
  it("renders a reusable score display with team colors and shared separator handling", () => {
    const markup = renderToStaticMarkup(
      <MatchScoreDisplay
        scores={{ team1: 2, team2: 7 }}
        className="score-shell"
        separator="-"
        separatorClassName="separator"
      />,
    );

    expect(markup).toContain(">2<");
    expect(markup).toContain(">7<");
    expect(markup).toContain(">-<");
    expect(markup).toContain("#f97316");
    expect(markup).toContain("#38bdf8");
  });

  it("renders shared team naming without hardcoding labels in host or controller shells", () => {
    const markup = renderToStaticMarkup(
      <TeamName team="team2" uppercase={false} suffix="Wins" />,
    );

    expect(markup).toContain("Nebulon Wins");
    expect(markup).toContain("#38bdf8");
  });
});
