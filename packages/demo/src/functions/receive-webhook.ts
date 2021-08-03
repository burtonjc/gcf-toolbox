import { RequestHandler } from 'express';
import uuidv4 from 'uuid/v4';

import { TOPIC_NAME, TRANSACTION_HEADER } from '../constants';
import { getTopic } from '../helpers/pubsub';
import { ReceivePubSubData } from './receive-pubsub';

export const receiveWebhook: RequestHandler = async (req, res) => {
  const name = req.query.name as string | undefined;
  const transactionId = req.header(TRANSACTION_HEADER) || uuidv4();
  const topic = await getTopic(TOPIC_NAME);
  const data: ReceivePubSubData = { name };
  const eventId = await topic.publishJSON(data, { transactionId });

  res.setHeader(TRANSACTION_HEADER, transactionId);
  res.json({
    event: eventId,
    message: `Hello, ${name || 'World'}!`,
  });
};
