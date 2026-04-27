import { useOfficeFinalTotalMoney } from "../../game/stores";

export function OfficeHostTopHud({
  timeRemainingMs,
}: {
  timeRemainingMs: number;
}) {
  const finalTotalMoney = useOfficeFinalTotalMoney();

  return (
    <div className="mb-4 flex w-full items-center justify-center gap-8 text-center">
      <span className="text-foreground text-3xl font-bold">
        EUR {finalTotalMoney}
      </span>
      <span className="text-foreground inline-block w-20 text-center text-2xl font-bold">
        {Math.floor(timeRemainingMs / 60000)}:
        {String(Math.floor((timeRemainingMs % 60000) / 1000)).padStart(2, "0")}
      </span>
    </div>
  );
}
