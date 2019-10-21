import execa from 'execa';

import { FunctionConfig } from './config.helper';

/**
 * Set the gcloud project
 * @param project The GCP project id.
 */
export const setGcloudProject = (project: string) => {
  return execa('gcloud', ['config', 'set', 'project', project])
}

export const depolyFunction = (config: FunctionConfig) => {
  const args = [
    'functions', 'deploy', config.name,
    '--runtime', config.runtime
  ];

  if (config.entryPoint) {
    args.push('--entry-point', config.entryPoint)
  }

  if (config.source) {
    args.push('--source', config.source)
  }

  if (!config.trigger || config.trigger === 'http') {
    args.push('--trigger-http');
  } else if ('topic' in config.trigger) {
    args.push('--trigger-topic', config.trigger.topic);
  } else if ('event' in config.trigger) {
    args.push('--trigger-event', config.trigger.event);
    args.push('--trigger-resource', config.trigger.resource);
  } else if ('bucket' in config.trigger) {
    args.push('--trigger-bucket', config.trigger.bucket)
  }

  return execa('gcloud', args);
}
