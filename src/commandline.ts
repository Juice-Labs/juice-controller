export type Options = {
  quiet: boolean;
  verbose: number;
  nobanner: boolean;

  port: number;
  ip: string;

  logs: string;
};

var argsParser = require("yargs/yargs")(process.argv.slice(2))
  .config()
  .option("quiet", {
    alias: "q",
    description: "Prevents all output",
    type: "boolean",
    default: false,
  })
  .option("verbose", {
    alias: "v",
    description: "Increases the verbosity level, defaults to errors only",
    type: "count",
  })
  .option("nobanner", {
    description: "Prevents the output of the application banner",
    type: "boolean",
    default: false,
  })
  .option("ip", {
    description: "IP address to bind",
    type: "string",
    default: "0.0.0.0",
  })
  .option("port", {
    alias: "p",
    description: "Port to bind",
    type: "number",
    default: 43210
  })
  .option("logs", {
    description: "Log directory",
    type: "string",
    default: "logs",
  })
  .help()
  .alias("help", "h").argv;

export const argv: Options = argsParser
