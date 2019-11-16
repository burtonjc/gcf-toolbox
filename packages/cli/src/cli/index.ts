import { inspect } from 'util';

import chalk from 'chalk';
import meow from 'meow';

import {
  executeSubCommand
} from '../helpers/command.helper';

export const cli = async () => {
  const cli =  meow(`
    ${chalk.underline(`Usage`)}
      $ giccup <command> [options] ...

    ${chalk.underline('Global Options')}
      --help, -h           Show help text

    ${chalk.underline('Commands')}
      deploy               Deploy resources to GCP
      init                 Create giccup.config.json file
      serve                Serve resources locally for development

    ${chalk.underline('Examples')}
      giccup deploy        Deploy all resources to GCP
  `, {
    autoHelp: false,
    flags: {
      help: { alias: '-h' },
    },
  });

  if ( cli.input.length === 0 ) {
    cli.showHelp(0);
  }

  try {
    await executeSubCommand(cli, __dirname);
  } catch (error) {
    console.log(chalk.red(error.message));
    process.exit(1);
  }
}
