import { resolve } from 'path';

import {
  NoProjectSpecifiedError,
  ProjectNotFoundInConfigError,
} from '../cli/errors';

export const CONFIG_FILE_NAME = 'giccup.config.json';
export const CONFIG_SCHEMA_FILE_NAME = 'giccup.config.schema.json';

export interface EventTrigger {
  event: string;
  resource: string;
}

export interface PubSubTrigger {
  topic: string;
}

export interface StorageTrigger {
  bucket: string;
}

export type TriggerType =
  | EventTrigger
  | PubSubTrigger
  | StorageTrigger
  | undefined;

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
  };
}

export interface RawGiccupConfig {
  $schema: string;
  defaultProject?: string;
  projects?: {
    [name: string]: RawProjectConfig;
  };
}

export interface FunctionConfig<T extends TriggerType = TriggerType>
  extends RawFunctionConfig {
  environmentFile?: string;
  name: string;
  trigger: T;
}

export class ProjectConfig {
  constructor(private _projectId: string, private config: RawProjectConfig) {}

  public get environmentFile() {
    return this.config.environmentFile;
  }

  public get functions(): FunctionConfig<TriggerType>[] {
    const functions = [] as FunctionConfig[];

    for (const key in this.config.functions) {
      functions.push(
        Object.assign(
          {
            environmentFile: this.config.environmentFile,
            name: key,
            trigger: undefined,
          },
          this.config.functions[key]
        )
      );
    }

    return functions;
  }

  public get projectId() {
    return this._projectId;
  }
}

export const getProjectConfig = (projectId?: string) => {
  const path = resolve(process.cwd(), CONFIG_FILE_NAME);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
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
};
