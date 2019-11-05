import { resolve } from 'path';

import { NoProjectSpecifiedError, ProjectNotFoundInConfigError } from '../cli/errors';

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

interface RawProjectConfig {
  environmentFile?: string;
  functions?: {
    [name: string]: RawFunctionConfig;
  }
}

interface RawGiccupConfig {
  defaultProject?: string;
  projects?: {
    [name: string]: RawProjectConfig;
  }
}

export interface FunctionConfig<T extends TriggerType = TriggerType> extends RawFunctionConfig {
  environmentFile?: string;
  name: string;
  trigger: T; // Make this not optional in code for convenience
}

export class ProjectConfig {
  constructor(private _projectId: string, private config: RawProjectConfig) { }

  public get projectId() {
    return this._projectId;
  }

  public get functions(): FunctionConfig<TriggerType>[] {
    const functions = [] as FunctionConfig[];

    for (const key in this.config.functions) {
      functions.push(Object.assign({
        environmentFile: this.config.environmentFile,
        name: key,
        trigger: 'http',
      }, this.config.functions[key]));
    }

    return functions;
  }
}

export const getProjectConfig = (projectId?: string) => {
  const path = resolve(process.cwd(), 'giccup.config.json');
  const raw = require(path) as RawGiccupConfig;
  projectId = projectId || raw.defaultProject;

  if (!projectId) {
    throw new NoProjectSpecifiedError();
  }

  const project = raw.projects && raw.projects[projectId];

  if (!project) {
    throw new ProjectNotFoundInConfigError();
  }

  return new ProjectConfig(projectId, project);
}
