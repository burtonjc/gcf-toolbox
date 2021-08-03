import { CreateSubscriptionOptions, PubSub, Topic } from '@google-cloud/pubsub';

import { PROJECT_ID } from '../constants';

export const getTopic = async (name: string) => {
  const pubsub = new PubSub({ projectId: PROJECT_ID });

  const topic = await pubsub.topic(name);
  const [topicExists] = await topic.exists();
  if (!topicExists) {
    await topic.create();
  }

  return topic;
};

export const getSubscription = async (
  topic: string | Topic,
  name: string,
  options: CreateSubscriptionOptions
) => {
  const pubsub = new PubSub({ projectId: PROJECT_ID });

  if (typeof topic === 'string') {
    topic = await getTopic(topic);
  }

  const subscription = await pubsub.subscription(name, { topic });
  const [exists] = await subscription.exists();
  if (!exists) {
    await subscription.create(options);
  }

  return subscription;
};
