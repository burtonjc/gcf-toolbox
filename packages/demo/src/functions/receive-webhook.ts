import { RequestHandler } from "express";
import uuidv4 from "uuid/v4";

import { TOPIC_NAME, TRANSACTION_HEADER } from "../constants";
import { getTopic } from "../helpers/pubsub";

export const receiveWebhook: RequestHandler = async (req, res) => {
  const name = req.query.name;
  const transactionId = req.header(TRANSACTION_HEADER) || uuidv4();
  const topic = await getTopic(TOPIC_NAME);
  const eventId = await topic.publishJSON({ name }, { transactionId });

  res.setHeader(TRANSACTION_HEADER, transactionId);
  res.json({
    event: eventId,
    message: `Hello, ${name || "World"}!`,
  });
};
