import { existsSync, writeFileSync } from 'fs';

import chalk from 'chalk';
import commandExists from 'command-exists';
import execa from 'execa';
import Listr from 'listr';
import meow from 'meow';

import { CommandExecutor } from '../../helpers/command.helper';
import {
  CONFIG_FILE_NAME,
  CONFIG_SCHEMA_FILE_NAME,
} from '../../helpers/config.helper';
import { GcloudCLINotInstalled } from '../errors';

const EMPTY_CONFIG = `{
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
}`;

export const init: CommandExecutor = async () => {
  meow(
    `
    ${chalk.underline(`Usage`)}
      $ giccup init [options] ...

    ${chalk.underline('Global Options')}
      --help, -h                            Show help text
  `,
    {
      flags: {
        help: { alias: '-h' },
      },
    }
  );

  const tasks = new Listr([
    {
      title: 'Create config file',
      skip: () => existsSync(CONFIG_FILE_NAME),
      task: () => {
        writeFileSync(CONFIG_FILE_NAME, EMPTY_CONFIG);
      },
    },
    {
      title: 'Check Google Cloud SDK exists',
      task: async (ctx, task) => {
        try {
          await commandExists('gcloud');
        } catch (error) {
          throw new GcloudCLINotInstalled();
        }
      },
    },
    {
      title: 'Install the pubsub emulator',
      task: () => {
        return execa('gcloud', ['components', 'install', 'pubsub-emulator']);
      },
    },
  ]);

  return tasks
    .run()
    .then(() => {
      console.log();
      console.log(
        chalk.green('You are all set. Use `npx giccup --help` to get started.')
      );
    })
    .catch((error) => {
      console.log();
      console.log(chalk.red(error.message));
    });
};

export default init;
