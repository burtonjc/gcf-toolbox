import anyTest, { TestInterface } from 'ava';
import { createSandbox, SinonSandbox } from 'sinon';

import { receivePubSub } from './receive-pubsub';

// These have to be serial because they are stubbing a global resource (console)
const test = anyTest.serial as TestInterface<{ sinon: SinonSandbox, }>;

test.beforeEach((t) => {
  t.context.sinon = createSandbox();
});

test.afterEach.always((t) => {
  t.context.sinon.restore();
});

test('receivePubSub: should print a name', async t => {
  const log = t.context.sinon.stub(console, 'log');
  const name = 'Bob';
  const event = {
    data: Buffer.from(JSON.stringify({ name })).toString('base64'),
  };

  await receivePubSub(event, { });

  t.is(log.callCount, 1);
  t.is(log.firstCall.args[0], `Hello, ${name}!`);
});

test('receivePubSub: should default to hello world', async t => {
  const log = t.context.sinon.stub(console, 'log');
  const event = {
    data: Buffer.from(JSON.stringify({})).toString('base64'),
  };

  await receivePubSub(event, { });

  t.is(log.callCount, 1);
  t.is(log.firstCall.args[0], 'Hello, World!');
});
