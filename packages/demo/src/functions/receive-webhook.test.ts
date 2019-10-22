import { resolve } from 'path';

import { Message }                      from '@google-cloud/pubsub';
import anyTest, { TestInterface }       from 'ava';
import execa                            from 'execa';
import { Request, Response, }           from 'express';
import { IncomingHttpHeaders }          from 'http2';
import { createSandbox, SinonSandbox }  from 'sinon';
import uuidv4                           from 'uuid/v4';

import { TOPIC_NAME }             from '../constants';
import { getTopic }               from '../helpers/pubsub';
import { receiveWebhook }         from './receive-webhook';

const test = anyTest as TestInterface<{
  pubsubEmulator: execa.ExecaChildProcess;
  sinon: SinonSandbox;
}>;

test.before(async (t) => {
  const cmd = execa('gcloud', [
    'beta',
    'emulators',
    'pubsub',
    'start',
    `--data-dir=${resolve(__dirname, '..', '.tmp')}`,
  ], {
    stdin: 'ignore',
  });
  t.context.pubsubEmulator = cmd;
  t.log('Starting PubSub emulator.')
  await waitForEmulatorToStart(cmd);
  await initEmulatorEnv();
  t.log('Successfully started the PubSub emulator.')
});

test.after.always((t) => {
  const cmd = t.context.pubsubEmulator;

  if (cmd && !cmd.killed) {
    cmd.kill()
  }

  return cmd.catch((e) => {
    if (e.signal !== 'SIGTERM') {
      throw e;
    }
  }).then(() => {
    t.log('Successfully shutdown PubSub emulator.');
  });
});

test.beforeEach((t) => {
  t.context.sinon = createSandbox();
});

test.afterEach.always((t) => {
  t.context.sinon.restore();
});

test('receiveWebhook: should publish a name', async t => {
  const name = 'Bob';
  const transactionId = uuidv4();
  const req = {
    header: (name: string) => req.headers[name],
    headers: { 'x-transaction-id': transactionId } as IncomingHttpHeaders,
    query: { name },
  };
  const res = {
    headers: { } as IncomingHttpHeaders,
    json: t.context.sinon.stub(),
    setHeader: (name: string, value: string) => res.headers[name] = value,
  };
  const next = t.context.sinon.stub();

  const watcher = await watchForMessages(TOPIC_NAME);
  await receiveWebhook(req as Request, res as unknown as Response, next);
  const messages = (await watcher.stop()).filter((m) => {
    const attributes = m.attributes as { [key: string]: string };
    return attributes.transactionId === transactionId;
  });

  t.is(res.json.callCount, 1, 'Expected JSON response.');
  t.deepEqual(res.json.firstCall.args[0], { message: `Hello, ${ name }!` });
  t.is(messages.length, 1, 'Expected one message to be published.')
  const data = JSON.parse(messages[0].data.toString());
  t.deepEqual(data, { name: 'Bob' });
});

test('receiveWebhook: should default to hello world', async t => {
  const transactionId = uuidv4();
  const req = {
    header: (name: string) => req.headers[name],
    headers: { 'x-transaction-id': transactionId } as IncomingHttpHeaders,
    query: { },
  };
  const res = {
    headers: { } as IncomingHttpHeaders,
    json: t.context.sinon.stub(),
    setHeader: (name: string, value: string) => res.headers[name] = value,
  };
  const next = t.context.sinon.stub();

  const watcher = await watchForMessages(TOPIC_NAME);
  await receiveWebhook(req as Request, res as unknown as Response, next);
  const messages = (await watcher.stop()).filter((m) => {
    const attributes = m.attributes as { [key: string]: string };
    return attributes.transactionId === transactionId;
  });

  t.is(res.json.callCount, 1);
  t.deepEqual(res.json.firstCall.args[0], { message: `Hello, World!`, });
  t.is(messages.length, 1, 'Expected one message to be published.')
  const data = JSON.parse(messages[0].data.toString());
  t.deepEqual(data, { });
});

const waitForEmulatorToStart = (cmd: execa.ExecaChildProcess) => {
  return new Promise((resolve, reject) => {
    let resolved = false;
    let stdall = [] as string[];

    if (cmd.all) {
      cmd.all.on('data', (chunk: Buffer) => {
        const message = chunk.toString();
        stdall.push(message);
        if (message.includes('Server started, listening on')) {
          resolved = true;
          resolve();
        }
      });
    }

    cmd.once('exit', () => {
      if (!resolved) {
        reject(`Failed to start PubSub emulator:\n${ stdall.join('\n') }`);
      }
    });
  });
}

const initEmulatorEnv = async() => {
  // const output = await execa('gcloud', [
  //   'beta',
  //   'emulators',
  //   'pubsub',
  //   'env-init',
  //   `--data-dir=${resolve(__dirname, '..', '.tmp')}`,
  // ]);

  // const env = output.stdout.split('\n').reduce((acc, param) => {
  //   const [key, value] = param.replace('export ', '').split('=');
  //   acc[key] = value.replace('::1', 'localhost');
  //   return acc;
  // }, {} as { [key: string]: string });

  // console.log('PubSub env:', env);
  const env = { PUBSUB_EMULATOR_HOST: 'localhost:8085' };

  Object.assign(process.env, env);
}

const getSubscription = async (topicName: string) => {
  const topic = await getTopic(topicName);
  const subscriptionName = `test-${topicName}-${uuidv4()}-sub`;

  return topic.createSubscription(subscriptionName)
    .then((data) => data[0] )
    .catch(async (err) => {
      if (err && err.code === 6) {
        return topic.subscription(subscriptionName);
      }

      throw err;
    });
}

const watchForMessages = async (topicName: string) => {
  const subscription = await getSubscription(topicName);
  let messages = [] as Message[];

  subscription.on('message', (m: Message) => {
    messages.push(m);
  });

  return {
    stop: () => {
      return new Promise<Message[]>((resolve, reject) => {
        setTimeout(async () => {
          await subscription.delete();
          resolve(messages);
        }, 500);
      });
    }
  };
}
