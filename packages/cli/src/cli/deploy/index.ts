import { inspect } from 'util';

import chalk from 'chalk';
import Listr, { ListrTask } from 'listr';
import meow from 'meow';

import { CommandExecutor } from '../../helpers/command.helper';
import { FunctionConfig, getProjectConfig } from '../../helpers/config.helper';
import { depolyFunction, setGcloudProject } from '../../helpers/gcloud.helper';

export const deploy: CommandExecutor = async () => {
  const cli = meow(
    `
    ${chalk.underline(`Usage`)}
      $ giccup deploy <resource> [options] ...

    ${chalk.underline('Options')}
      --project, -p                         Id of GCP project to deploy

    ${chalk.underline('Global Options')}
      --help, -h                            Show help text

    ${chalk.underline('Resources')}
      functions <entry points ...>          Deploy functions

    ${chalk.underline('Examples')}
      giccup deploy                               Deploy all resources for defaultProject
      giccup deploy functions --project=proj-1    Deploy all functions for proj-1
      giccup deploy functions fun1 fun2           Deploy the fun1 and fun2 functions for defaultProject
  `,
    {
      flags: {
        help: { alias: '-h' },
        project: { alias: '-p' },
      },
    }
  );

  const [, resource, ...args] = cli.input;

  if (resource && !['functions'].includes(resource)) {
    console.error(
      '\n',
      chalk.red(`Error: Unrecognized resource type "${resource}".`)
    );
    cli.showHelp(1);
  }

  const config = getProjectConfig(cli.flags.project);

  const tasks = new Listr(
    [
      {
        title: 'Set project in gcloud',
        task: () => setGcloudProject(config.projectId),
      },
    ],
    // Bug in the typings where collapse is unknown
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { collapse: false } as any
  );

  if (!resource || resource === 'functions') {
    if (!config.functions.length) {
      console.error(chalk.red('No functions found in giccup.config.json'));
      return process.exit(1);
    }

    const deployTasks = buildTasksToDeployFunctions(config.functions, args);
    tasks.add({
      title: 'Deploy functions',
      task: () => new Listr(deployTasks, { concurrent: true }),
    });
  }

  try {
    await tasks.run();
  } catch (e) {
    console.log();
    console.error(chalk.red('Failed to deploy functions:', inspect(e)));
  }
};

const buildTasksToDeployFunctions = (
  configs: FunctionConfig[],
  names?: string[]
): ListrTask[] => {
  if (names && names.length) {
    validateFunctionNames(configs, names);
    configs = configs.filter((c) => names.includes(c.name));
  }

  return configs.map(
    (c) =>
      ({
        title: c.name,
        task: () => depolyFunction(c),
      } as ListrTask)
  );
};

const validateFunctionNames = (configs: FunctionConfig[], names: string[]) => {
  for (const name of names) {
    const config = configs.find((c) => c.name === name);
    if (!config) {
      console.error(
        '\n',
        chalk.red(
          `Error: No function named "${name}" found in giccup.config.json.`
        )
      );
      process.exit(1);
    }
  }
};

export default deploy;
