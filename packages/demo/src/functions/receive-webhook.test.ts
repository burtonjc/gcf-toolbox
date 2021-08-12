import { IncomingHttpHeaders } from 'http2';

import { EmulatorTestingEnvironment } from '@gcf-tools/gcloud-pubsub-emulator/testing';
import { Message } from '@google-cloud/pubsub';
import { Request, Response } from 'express';
import uuidv4 from 'uuid/v4';

import { TOPIC_NAME } from '../constants';
import { getTopic } from '../helpers/pubsub';
import { receiveWebhook } from './receive-webhook';

describe('Receive webhook', () => {
  const emulatorTestingEnv = new EmulatorTestingEnvironment();

  beforeAll(() => emulatorTestingEnv.setup());
  afterAll(() => emulatorTestingEnv.teardown());

  it('publishes a name', async () => {
    const name = 'Bob';
    const transactionId = uuidv4();
    const req = {
      header: (name: string) => req.headers[name],
      headers: { 'x-transaction-id': transactionId } as IncomingHttpHeaders,
      query: { name },
    };
    const res = {
      headers: {} as IncomingHttpHeaders,
      json: jest.fn(),
      setHeader: (name: string, value: string) => (res.headers[name] = value),
    };
    const next = jest.fn();

    const watcher = await watchForMessages(TOPIC_NAME);
    await receiveWebhook(
      req as unknown as Request,
      res as unknown as Response,
      next
    );
    const messages = (await watcher.stop()).filter((m) => {
      const attributes = m.attributes as { [key: string]: string };
      return attributes.transactionId === transactionId;
    });

    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.json.mock.calls[0][0].message).toEqual(`Hello, ${name}!`);
    expect(messages.length).toBe(1);
    const data = JSON.parse(messages[0].data.toString());
    expect(data).toEqual({ name: 'Bob' });
  });

  it('defaults to hello world', async () => {
    const transactionId = uuidv4();
    const req = {
      header: (name: string) => req.headers[name],
      headers: { 'x-transaction-id': transactionId } as IncomingHttpHeaders,
      query: {},
    };
    const res = {
      headers: {} as IncomingHttpHeaders,
      json: jest.fn(),
      setHeader: (name: string, value: string) => (res.headers[name] = value),
    };
    const next = jest.fn();

    const watcher = await watchForMessages(TOPIC_NAME);
    await receiveWebhook(req as Request, res as unknown as Response, next);
    const messages = (await watcher.stop()).filter((m) => {
      const attributes = m.attributes as { [key: string]: string };
      return attributes.transactionId === transactionId;
    });

    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.json.mock.calls[0][0].message).toEqual('Hello, World!');
    expect(messages.length).toBe(1);
    const data = JSON.parse(messages[0].data.toString());
    expect(data).toEqual({});
  });
});

const getSubscription = async (topicName: string) => {
  const topic = await getTopic(topicName);
  const subscriptionName = `test-${topicName}-${uuidv4()}-sub`;

  return topic
    .createSubscription(subscriptionName)
    .then((data) => data[0])
    .catch(async (err) => {
      if (err && err.code === 6) {
        return topic.subscription(subscriptionName);
      }

      throw err;
    });
};

const watchForMessages = async (topicName: string) => {
  const subscription = await getSubscription(topicName);
  const messages = [] as Message[];

  subscription.on('message', (m: Message) => {
    messages.push(m);
  });

  return {
    stop: () => {
      return new Promise<Message[]>((resolve) => {
        setTimeout(async () => {
          await subscription.delete();
          resolve(messages);
        }, 500);
      });
    },
  };
};
