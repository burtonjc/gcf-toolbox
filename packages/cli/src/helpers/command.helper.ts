import { resolve } from 'path';

import chalk from 'chalk';
import { Result } from 'meow';

export interface CommandExecutor {
  (): Promise<void>;
}

let level = 0;
export const executeSubCommand = async (cli: Result, dir: string) => {
  const command = cli.input[level++];

  try {
    const commandPath = resolve(dir, command);
    debug(`${command}:`, 'requiring task from', commandPath);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const executor = require(commandPath).default as CommandExecutor;
    await executor();
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log(`
        \r  ${chalk.red(`Error: unknown command "${chalk.bold(command)}"`)}
        \r  ${chalk.grey(`Run 'npx giccup --help' for usage`)}.
      `);
    } else {
      throw error;
    }
  }
};

export const debug = (...log: unknown[]) => {
  if (process.env.DEBUG) {
    console.log(chalk.blue('DEBUG: ', ...log.toString()));
  }
};
