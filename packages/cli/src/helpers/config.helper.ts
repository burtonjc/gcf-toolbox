import { resolve } from 'path';

export interface EventTrigger {
  event: string;
  resource: string;
}

export type HttpTrigger = 'http';

export interface PubSubTrigger {
  topic: string;
}

export interface StorageTrigger {
  bucket: string;
}

export type TriggerType = EventTrigger | HttpTrigger | PubSubTrigger | StorageTrigger;

interface RawFunctionConfig<T extends TriggerType = TriggerType> {
  entryPoint?: string;
  runtime: string;
  source?: string;
  trigger?: T;
}

interface RawGiccupConfig {
  projects?: {
    [name: string]: {
      functions?: {
        [name: string]: RawFunctionConfig[];
      }
    }
  }
}

export interface FunctionConfig<T extends TriggerType = TriggerType> extends RawFunctionConfig {
  // Make this not optional in code for convenience
  trigger: T;
}

export class GiccupConfig {
  constructor(private config: RawGiccupConfig) { }

  public get functions(): FunctionConfig<TriggerType>[] {
    const rawFunctions = (this.config.resources && this.config.resources.functions) || [];
    return rawFunctions.map((rf) => {
      rf.trigger = rf.trigger || 'http';
      return rf as FunctionConfig<TriggerType>;
    });
  }

  public get project() {
    return this.config.project;
  }
}

export const getProjectConfig = (project?: string) => {
  const path = resolve(process.cwd(), 'giccup.config.json');
  const raw = require(path) as RawGiccupConfig;

  return new GiccupConfig(raw);
}
