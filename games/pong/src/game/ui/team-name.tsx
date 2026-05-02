import { getTeamColor, getTeamLabel, type TeamId } from "../domain/team";

interface TeamNameProps {
  team: TeamId;
  className?: string;
  uppercase?: boolean;
  suffix?: string;
}

export const TeamName = ({
  team,
  className,
  uppercase = true,
  suffix,
}: TeamNameProps) => {
  const label = `${getTeamLabel(team)}${suffix ? ` ${suffix}` : ""}`;

  return (
    <span className={className} style={{ color: getTeamColor(team) }}>
      {uppercase ? label.toUpperCase() : label}
    </span>
  );
};
