import { inspect } from 'util';

import GooglePubSubEmulator from '@gcf-tools/gcloud-pubsub-emulator';
import { PubSub } from '@google-cloud/pubsub';
import chalk from 'chalk';
import execa from 'execa';
import Listr from 'listr';
import meow from 'meow';

import { CommandExecutor } from '../../helpers/command.helper';
import {
  FunctionConfig,
  getGiccupConfig,
  GiccupConfig,
  PubSubTrigger,
} from '../../helpers/config.helper';
import { resolve } from 'dns';

const VerboseRenderer = require('listr-verbose-renderer');

export const serve: CommandExecutor = async () => {
  const cli =  meow(`
    Serve up a local environment to mimic how things run in GCP. This relies on
    the Google PubSub Emulator component in gcloud.

    ${chalk.underline(`Usage`)}
      $ giccup serve [options] ...

    ${chalk.underline('Global Options')}
      --help, -h                  Show help text
  `, {
    flags: {
      help: { alias: '-h' }
    }
  });

  const config = getGiccupConfig();
  const emulator = getEmulator(config);
  const tasks = new Listr([{
    title: 'Start PubSub emulator',
    task: (ctx, task) => emulator.start()
  }, {
    title: 'Create PubSub triggers',
    task: async () => {
      const eventTriggerdFns = config.functions.filter((f) =>
        (f.trigger as Object).hasOwnProperty('topic')
      ) as FunctionConfig<PubSubTrigger>[];

      for (const fn of eventTriggerdFns) {
        await createPushSubscription(config, fn);
      }
    },
  }, {
    title: 'Serve Functions',
    task: (ctx, task) => {
      if (!config.functions.length) {
        return;
      }

      return new Listr(config.functions.map((f, index) => ({
        title: f.name,
        task: () => {
          let args = [
            'functions-framework',
            `--target=${f.entryPoint || f.name}`,
            `--port=${ 8080 + index }`,
          ]

          if (f.source) {
            args = [ ...args, `--source=${f.source}` ];
          }

          if (f.trigger !== 'http') {
            args = [ ...args, `--signature-type=event` ];
          }

          return execa('npx', args, { all: true }).all;
        }
      })), { concurrent: true, exitOnError: false })
    },
    skip: () => config.functions.length === 0,
  }], { renderer: VerboseRenderer, });

  try {
    await new Promise((resolve, reject) => {
      const taskPromise = tasks.run();
      process.on('SIGINT', async () => {
        await taskPromise.then(resolve, reject);
      });
    });
  } catch (error) {
    console.error(chalk.red('Something went terribly wrong!'));
    console.error(chalk.red(inspect(error)));
  } finally {
    console.log(chalk.grey('Stopping the PubSub emulator...'));
    await emulator.stop();
    console.log(chalk.green('Have a good one!'));
  }
}

/*****************************************************************************/

let emulator: GooglePubSubEmulator;
const getEmulator = (config: GiccupConfig) => {
  if (!emulator) {
    emulator = new GooglePubSubEmulator({
      // debug: true,
      project: config.project,
    });
  }

  return emulator;
}

const createPushSubscription = async (config: GiccupConfig, fn: FunctionConfig<PubSubTrigger>) => {
  const pubsub = new PubSub({ projectId: config.project });

  const topic = await pubsub.topic(fn.trigger.topic);
  const [topicExists] = await topic.exists();
  if (!topicExists) {
    await topic.create();
  }

  const fnIndex = config.functions.findIndex(f => f === fn);
  const subscription = await pubsub.subscription(
    `local-${fn.name}-${fn.trigger.topic}`,
    { topic }
  );
  const pushEndpoint = `http://localhost:${8080 + fnIndex}`;
  // const pushEndpoint = `http://localhost:3000/messages`;
  const [subscriptionExists] = await subscription.exists();
  if (subscriptionExists) {
    await subscription.modifyPushConfig({ pushEndpoint });
  } else {
    await subscription.create({ pushEndpoint });
  }
}

export default serve;
