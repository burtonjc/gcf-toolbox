import { readFileSync } from 'fs';

import GooglePubSubEmulator from '@gcf-tools/gcloud-pubsub-emulator';
import { PubSub } from '@google-cloud/pubsub';
import chalk from 'chalk';
import { safeLoad } from 'js-yaml';
import meow from 'meow';

import { CommandExecutor } from '../../helpers/command.helper';
import {
  FunctionConfig,
  getProjectConfig,
  ProjectConfig,
  PubSubTrigger,
} from '../../helpers/config.helper';
import { Dashboard } from './dashboard';
import { LocalFunction } from './local-function';

export const serve: CommandExecutor = async () => {
  const cli = meow(
    `
    Serve up a local environment to mimic how things run in GCP. This relies on
    the Google PubSub Emulator component in gcloud.

    ${chalk.underline(`Usage`)}
      $ giccup serve [options] ...

    ${chalk.underline('Options')}
    --project, -p                 Id of GCP project to serve
    --verbose, -v                 Enable verbose logging

    ${chalk.underline('Global Options')}
      --help, -h                  Show help text
  `,
    {
      flags: {
        help: { alias: '-h' },
        project: { alias: '-p' },
        verbose: { alias: '-v', default: false },
      },
    }
  );

  const config = getProjectConfig(cli.flags.project);
  const env = (
    config.environmentFile
      ? safeLoad(readFileSync(config.environmentFile, 'utf8'))
      : {}
  ) as Record<string, string>;
  const emulator = getEmulator(config, {
    debug: cli.flags.verbose,
  });
  const functions = config.functions.map((fc, index) => {
    return new LocalFunction(fc, {
      debug: cli.flags.verbose,
      env,
      port: 8080 + index,
    });
  });

  const dashboard = new Dashboard(emulator, functions);

  const emP = emulator.start();
  dashboard.start();
  await emP;

  const eventTriggerdFns = config.functions.filter(
    (f) => f.trigger && 'topic' in f.trigger
  ) as FunctionConfig<PubSubTrigger>[];
  const subscriptions = await Promise.all(
    eventTriggerdFns.map((fc) => createPushSubscription(config, fc))
  );

  dashboard.pushSubscriptions = subscriptions;

  functions.forEach((fun) => fun.start());
};

/*****************************************************************************/

let __emulator__: GooglePubSubEmulator;
const getEmulator = (config: ProjectConfig, options?: { debug?: boolean }) => {
  if (!__emulator__) {
    __emulator__ = new GooglePubSubEmulator({
      debug: options && options.debug,
    });
  }

  return __emulator__;
};

const createPushSubscription = async (
  config: ProjectConfig,
  fn: FunctionConfig<PubSubTrigger>
) => {
  const pubsub = new PubSub({ projectId: config.projectId });
  const topic = await pubsub.topic(fn.trigger.topic);

  const [topicExists] = await topic.exists();
  if (!topicExists) {
    await topic.create();
  }

  const fnIndex = config.functions.findIndex((f) => f.name === fn.name);
  const subscription = await topic.subscription(
    `local-${fn.name}-${fn.trigger.topic}`
  );
  const pushEndpoint = `http://localhost:${8080 + fnIndex}/projects/${
    config.projectId
  }/topics/${fn.trigger.topic}`;

  const [subscriptionExists] = await subscription.exists();
  if (subscriptionExists) {
    await subscription.modifyPushConfig({ pushEndpoint });
  } else {
    await subscription.create({ pushEndpoint });
  }

  return subscription;
};

export default serve;
