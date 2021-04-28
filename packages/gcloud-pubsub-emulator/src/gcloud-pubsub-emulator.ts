import { existsSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import execa = require('execa');
import { BehaviorSubject } from 'rxjs';
import kill from 'tree-kill';

import {
  EmulatorDataDirNoExist,
  EmulatorNotInitializedError,
  PortAlreadyInUseError,
} from './errors';

/**
 * Possible states of the Emulator
 */
export enum EmulatorStates {
  Errored = 'errored',
  Running = 'running',
  Starting = 'starting',
  Stopped = 'stopped',
}

export interface EmulatorOptions {
  /**
   * The directory to be used to store/retrieve data/config for an emulator
   * run.
   *
   * @default <USER_CONFIG_DIR>/emulators/pubsub
   */
  dataDir?: string;

  /**
   * Enable more verbose console output
   *
   * @default false
   */
  debug?: boolean;

  /**
   * The host:port to which the emulator should be bound.
   *
   * @default localhost:8085
   */
  hostPort?: number;

  /** GCP project id */
  project: string;
}

class GooglePubSubEmulator {
  private cmd?: execa.ExecaChildProcess;
  private run?: Promise<void>;
  private _error$ = new BehaviorSubject<Error | null>(null);
  private _state$ = new BehaviorSubject(EmulatorStates.Stopped);

  constructor(private options: EmulatorOptions) {}

  // TODO: need to verify dataDir exists
  public async start() {
    const dataDir = this.ensureDataDir(this.options.dataDir);
    const params = this.buildCommandParams({ ...this.options, dataDir });
    this.cmd = execa('gcloud', params, { all: true });
    this._state$.next(EmulatorStates.Starting);

    if (this.options.debug) {
      this.cmd.stdout && this.cmd.stdout.pipe(process.stdout);
      this.cmd.stderr && this.cmd.stderr.pipe(process.stderr);
    }

    this.run = this.cmd
      .catch((error) => {
        if (error.signal === 'SIGINT') {
          this._state$.next(EmulatorStates.Stopped);
        } else {
          this._state$.next(EmulatorStates.Errored);
          this._error$.next(error);
        }
      })
      .then(() => {
        this.teardownEnvironment();
        delete this.cmd;
      });

    try {
      await this.waitForEmulateToStart();
      await this.initEnvironment();
      this._state$.next(EmulatorStates.Running);
    } catch (error) {
      this._state$.next(EmulatorStates.Errored);
      return Promise.reject(error);
    }
  }

  public stop() {
    if (!this.cmd) {
      return Promise.resolve(this._state$.getValue());
    }

    const pid = this.cmd.pid;
    return new Promise<void>((resolve, reject) => {
      kill(pid, 'SIGINT', (e) => {
        if (e) {
          return reject(e);
        }

        resolve();
      });
    })
      .then(() => this.run)
      .then(() => this._state$.getValue());
  }

  public get error$() {
    return this._error$.asObservable();
  }

  public get state$() {
    return this._state$.asObservable();
  }

  private ensureDataDir(path?: string): string {
    if (!path) {
      return mkdtempSync(join(tmpdir(), 'pubsub-emulator-'));
    } else if (existsSync(path)) {
      return path;
    } else {
      throw new EmulatorDataDirNoExist();
    }
  }

  private buildCommandParams(options: EmulatorOptions) {
    const params = ['beta', 'emulators', 'pubsub', 'start'];

    if (options.dataDir) {
      params.push('--data-dir=' + options.dataDir);
    }

    if (options.debug) {
      params.push('--log-http');
      params.push('--user-output-enabled');
      params.push('--verbosity=debug');
    }

    if (options.hostPort) {
      params.push(`--host-port=${options.hostPort}`);
    }

    params.push(`--project=${options.project}`);

    return params;
  }

  private async initEnvironment() {
    const { stdout } = await execa('gcloud', [
      'beta',
      'emulators',
      'pubsub',
      'env-init',
    ]);
    const env = stdout
      .trim()
      .replace(/export\s/g, '')
      .split('\n')
      .reduce((agg, item) => {
        const [key, value] = item.split('=');
        return { ...agg, [key]: value };
      }, {});
    Object.assign(process.env, env);
  }

  private teardownEnvironment() {
    delete process.env.PUBSUB_EMULATOR_HOST;
  }

  private waitForEmulateToStart = () => {
    return new Promise<void>((resolve, reject) => {
      if (!(this.cmd && this.cmd.all)) {
        return reject(new EmulatorNotInitializedError());
      }

      const waitForStarted = (data: Buffer) => {
        if (data.toString().includes('Server started, listening on ')) {
          this.cmd && this.cmd.all && this.cmd.all.off('data', waitForStarted);
          return resolve();
        }

        if (data.toString().includes('java.io.IOException: Failed to bind')) {
          this.cmd && this.cmd.all && this.cmd.all.off('data', waitForStarted);
          return reject(new PortAlreadyInUseError());
        }
      };

      this.cmd.all.on('data', waitForStarted);
    });
  };
}

export default GooglePubSubEmulator;
