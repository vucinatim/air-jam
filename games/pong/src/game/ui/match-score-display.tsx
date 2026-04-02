import { getTeamColor } from "../domain/team";

interface MatchScoreDisplayProps {
  scores: { team1: number; team2: number };
  className?: string;
  scoreClassName?: string;
  separatorClassName?: string;
  separator?: string;
}

export const MatchScoreDisplay = ({
  scores,
  className,
  scoreClassName,
  separatorClassName,
  separator = ":",
}: MatchScoreDisplayProps) => {
  return (
    <div className={className}>
      <span
        className={scoreClassName}
        style={{ color: getTeamColor("team1") }}
      >
        {scores.team1}
      </span>
      <span className={separatorClassName}>{separator}</span>
      <span
        className={scoreClassName}
        style={{ color: getTeamColor("team2") }}
      >
        {scores.team2}
      </span>
    </div>
  );
};
