import { receivePubSub } from './receive-pubsub';

describe('Receive pubsub', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('receivePubSub: should print a name', async () => {
    const name = 'Bob';
    const event = {
      data: Buffer.from(JSON.stringify({ name })).toString('base64'),
    };

    await receivePubSub(event, {});

    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(`Hello, ${name}!`);
  });

  it('receivePubSub: should default to hello world', async () => {
    const event = {
      data: Buffer.from(JSON.stringify({})).toString('base64'),
    };

    await receivePubSub(event, {});

    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith('Hello, World!');
  });
});
