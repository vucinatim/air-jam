import {
  executeDevLogsCli,
  formatDevLogDetails as formatDetails,
  formatDevLogsHelp as formatHelp,
  parseDevLogsCliArgs as parseCliArgs,
  passesDevLogFilter as passesFilter,
} from "../src/logging/dev-logs-cli";

export { formatDetails, formatHelp, parseCliArgs, passesFilter };

void executeDevLogsCli(process.argv.slice(2)).then((exitCode) => {
  process.exitCode = exitCode;
});
