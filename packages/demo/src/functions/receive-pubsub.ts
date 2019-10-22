import { Context } from '@google-cloud/functions-framework';

export const receivePubSub = (event: { data: string }, context: Context) => {
  console.log('YO PUBSUB!');
  console.log('event:', JSON.stringify(event));
  console.log('context:', JSON.stringify(context));
  const json = Buffer.from(event.data, 'base64').toString()
  const data = JSON.parse(json);

  console.log(`Hello, ${data.name || 'World'}!`);
}
