import { existsSync, writeFileSync } from 'fs';

import chalk from 'chalk';
import meow from 'meow';

import { CommandExecutor } from "../../helpers/command.helper";
import {
  CONFIG_FILE_NAME,
  CONFIG_SCHEMA_FILE_NAME,
  RawGiccupConfig,
} from "../../helpers/config.helper";

const config = `{
  "$schema": "./node_modules/@gcf-tools/cli/${CONFIG_SCHEMA_FILE_NAME}",

  // "defaultProject": null                               /* Default project to use for commands when --project is not specified */
  "projects": {                                           /* Project configurations */
    // "sample-project": {                                /* GCP project id */
    //   "environmentFile": "./path/to/environment.yml"   /* Environment variables to use during serve and deploys */
    //   "functions": {
    //     "sampleFunction": {                            /* GCP function id */
    //       "runtime": "nodejs10",                       /* GCP function runtime */
    //       "trigger": {                                 /* GCP function trigger type */
    //         "topic": "sample-topic"
    //       }
    //     }
    //   }
    // }
  }
}`

export const init: CommandExecutor = async () => {
  const cli =  meow(`
    ${chalk.underline(`Usage`)}
      $ giccup init [options] ...

    ${chalk.underline('Global Options')}
      --help, -h                            Show help text
  `, {
    flags: {
      help: { alias: '-h' },
    }
  });

  if (existsSync(CONFIG_FILE_NAME)) {
    console.log(chalk.cyan('Config file already exists ... exiting.'));
    return;
  }

  writeFileSync(CONFIG_FILE_NAME, config);

  console.log(chalk.green(`Successfully created ${chalk.bold(CONFIG_FILE_NAME)}!`));
}

export default init;
