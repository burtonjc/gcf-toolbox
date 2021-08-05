import execa, { ExecaChildProcess } from 'execa';
import { BehaviorSubject, ReplaySubject } from 'rxjs';

import { FunctionConfig } from '../../helpers/config.helper';

export enum FunctionState {
  Errored = 'errored',
  Running = 'running',
  Starting = 'starting',
  Stopped = 'stopped',
  Stopping = 'stopping',
}

export interface LocalFunctionOptions {
  debug?: boolean;
  env?: { [prop: string]: string };
  port: number;
}

export class LocalFunction {
  private stateSubject = new BehaviorSubject(FunctionState.Stopped);
  private process?: ExecaChildProcess;
  private _log$ = new ReplaySubject<string>();

  constructor(
    private config: FunctionConfig,
    private options: LocalFunctionOptions = {} as LocalFunctionOptions
  ) {}

  public async start() {
    this.setState(FunctionState.Starting);

    const { cmd, args } = this.getCommand();
    this.process = execa(cmd, args, { all: true, env: this.options.env });
    this.process.all?.on('data', (chunk: Buffer) => {
      this._log$.next(chunk.toString());
    });
    this.process.catch((error) => {
      this.setState(FunctionState.Errored);
    });

    try {
      await this.waitForProcessReady();
      this.setState(FunctionState.Running);
    } catch (error) {
      console.error(error);
      this.setState(FunctionState.Errored);
      return Promise.reject(error);
    }
  }

  public stop() {
    if (this.process) {
      this.setState(FunctionState.Stopping);
      this.process.kill();
      delete this.process;
      this.setState(FunctionState.Stopped);
    }
    return Promise.resolve();
  }

  public get log$() {
    return this._log$.asObservable();
  }

  public get name() {
    return this.config.name;
  }

  public get port() {
    return this.options.port;
  }

  public get state$() {
    return this.stateSubject.asObservable();
  }

  public get currentState() {
    return this.stateSubject.value;
  }

  private getCommand() {
    let args = [
      'functions-framework',
      `--target=${this.config.entryPoint || this.config.name}`,
      `--port=${this.options.port}`,
    ];

    if (this.config.source) {
      args = [...args, `--source=${this.config.source}`];
    }

    if (this.config.trigger) {
      args = [...args, `--signature-type=event`];
    }

    return { cmd: 'npx', args };
  }

  private setState(state: FunctionState) {
    this.stateSubject.next(state);
  }

  private waitForProcessReady() {
    return new Promise<void>((resolve, reject) => {
      if (!(this.process && this.process.stdout)) {
        return reject(new Error('No process or process not emitting logs.'));
      }

      const stdout = this.process.stdout;

      const waitForStarted = (data: Buffer) => {
        if (data.toString().includes('Serving function...')) {
          stdout.off('data', waitForStarted);
          return resolve();
        }
      };

      stdout.on('data', waitForStarted);
    });
  }
}
