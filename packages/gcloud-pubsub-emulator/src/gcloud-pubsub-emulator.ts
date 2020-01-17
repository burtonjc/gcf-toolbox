import { BehaviorSubject } from 'rxjs';
import execa = require("execa");

import {
  EmulatorNotInitializedError,
  PortAlreadyInUseError,
} from './errors';

export enum GooglePubSubEmulatorStates {
  Errored   = 'errored',
  Running   = 'running',
  Starting  = 'starting',
  Stopped   = 'stopped',
}

export interface GooglePubSubEmulatorOptions {
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
  private _port?: number;
  private stateSubject = new BehaviorSubject(GooglePubSubEmulatorStates.Stopped);

  constructor(private options: GooglePubSubEmulatorOptions) { }

  public async start() {
    this.stateSubject.next(GooglePubSubEmulatorStates.Starting);
    const params = this.buildCommandParams();
    this.cmd = execa('gcloud', params, { all: true });

    if (this.options.debug) {
      this.cmd.stdout && this.cmd.stdout.pipe(process.stdout);
      this.cmd.stderr && this.cmd.stderr.pipe(process.stderr);
    }

    try {
      await this.waitForEmulateToStart();
      await this.initEnvironment();
      this.stateSubject.next(GooglePubSubEmulatorStates.Running);
    } catch (error) {
      this.stateSubject.next(GooglePubSubEmulatorStates.Errored);
      return Promise.reject(error);
    }
  }

  public stop() {
    if (!this.cmd) {
      console.log('Emulator not running.');
      return Promise.resolve();
    }
    this.cmd.kill();
    delete this.cmd;
    this.teardownEnvironment();
    this.stateSubject.next(GooglePubSubEmulatorStates.Stopped);
  }

  public get port() {
    return this._port;
  }

  public get state() {
    return this.stateSubject.asObservable();
  }

  public get currentState() {
    return this.stateSubject.value;
  }

  public get log() {
    if (!this.cmd) {
      return;
    }

    return {
      all: this.cmd.all,
      stderr: this.cmd.stderr,
      stdout: this.cmd.stdout,
    }
  }

  private buildCommandParams() {
    const params = ['beta', 'emulators', 'pubsub', 'start'];

    if (this.options.dataDir) {
      params.push('--data-dir=' + this.options.dataDir);
    }

    if (this.options.debug) {
      params.push('--log-http');
      params.push('--user-output-enabled');
      params.push('--verbosity=debug');
    }

    if (this.options.hostPort) {
      params.push(`--host-port=${this.options.hostPort}`);
    }

    params.push(`--project=${this.options.project}`);

    return params;
  }

  private async initEnvironment() {
    const { stdout } = await execa('gcloud', ['beta', 'emulators', 'pubsub', 'env-init']);
    const env = stdout.trim().replace(/export\s/g, '').split('\n').reduce((agg, item) => {
      const [key, value] = item.split('=');
      return {...agg, [key]: value};
    }, {});

    Object.assign(process.env, env);
  }

  private async teardownEnvironment() {
    delete process.env.PUBSUB_EMULATOR_HOST;
  }

  private waitForEmulateToStart = () => {
    return new Promise<void>((resolve, reject) => {
      if (!(this.cmd && this.cmd.all)) {
        return reject(new EmulatorNotInitializedError());
      }

      const waitForStarted = (data: Buffer) => {
        if (data.toString().includes('Server started, listening on ')) {
          const match = data.toString().match(/listening on (\d+)/);
          if (match && match[1]) {
            this._port = parseInt(match[1]);
          }

          this.cmd && this.cmd.all && this.cmd.all.off('data', waitForStarted);
          return resolve();
        }

        if (data.toString().includes('java.io.IOException: Failed to bind')) {
          this.cmd && this.cmd.all && this.cmd.all.off('data', waitForStarted);
          return reject(new PortAlreadyInUseError());
        }
      }

      this.cmd.all.on("data", waitForStarted);
    });
  }
}

export default GooglePubSubEmulator;
