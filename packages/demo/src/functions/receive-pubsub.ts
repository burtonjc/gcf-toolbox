import { CloudFunctionsContext } from '@google-cloud/functions-framework';

interface Event {
  '@type': string;
  attributes: Record<string, unknown>;
  data: string;
}

export interface ReceivePubSubData {
  name: string | undefined;
}

export const receivePubSub = (event: Event, context: CloudFunctionsContext) => {
  const json = Buffer.from(event.data, 'base64').toString();
  const data: ReceivePubSubData = JSON.parse(json);

  console.log(`Hello, ${data.name || 'World'}!`);
};
