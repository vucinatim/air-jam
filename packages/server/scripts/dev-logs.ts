import {
  executeDevLogsCli,
  formatDevLogsHelp as formatHelp,
  formatDevLogDetails as formatDetails,
  parseDevLogsCliArgs as parseCliArgs,
  passesDevLogFilter as passesFilter,
} from "../src/logging/dev-logs-cli";

export { formatDetails, formatHelp, parseCliArgs, passesFilter };

void executeDevLogsCli(process.argv.slice(2)).then((exitCode) => {
  process.exitCode = exitCode;
});
