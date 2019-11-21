import execa, { ExecaChildProcess } from 'execa';

import { FunctionConfig } from "../../helpers/config.helper";
import { EventEmitter } from 'events';

export enum FunctionState {
  Errored   = 'errored',
  Running   = 'running',
  Starting  = 'starting',
  Stopped   = 'stopped',
}

export interface LocalFunctionOptions {
  debug?: boolean,
  env?: { [prop: string]: string },
  port?: number,
}

export class LocalFunction extends EventEmitter {
  private _state: FunctionState = FunctionState.Stopped;
  private process?: ExecaChildProcess;

  constructor(
    private config: FunctionConfig,
    private options: LocalFunctionOptions = {} as LocalFunctionOptions
  ) {
    super();
  }

  public async start() {
    const { cmd, args } = this.getCommand()

    this.process = execa(cmd, args, { all: true, env: this.options.env });
    this.setState(FunctionState.Starting)

    if (this.options.debug) {
      this.process.stdout && this.process.stdout.pipe(process.stdout);
      this.process.stderr && this.process.stderr.pipe(process.stderr);
    }

    try {
      await this.waitForProcessReady();
      this.setState(FunctionState.Running);
    } catch (error) {
      this.setState(FunctionState.Errored);
      return Promise.reject(error);
    }
  }

  public stop() {
    if (!this.process) {
      return Promise.resolve();
    }
    this.process.kill();
    delete this.process;
    this.setState(FunctionState.Stopped);
  }

  public get state() {
    return this._state;
  }

  private getCommand() {
    let args = [
      'functions-framework',
      `--target=${this.config.entryPoint || this.config.name}`,
      `--port=${ this.options.port }`,
    ]

    if (this.config.source) {
      args = [ ...args, `--source=${this.config.source}` ];
    }

    if (this.config.trigger !== 'http') {
      args = [ ...args, `--signature-type=event` ];
    }

    return { cmd: 'npx', args };
  }

  private setState(state: FunctionState) {
    this._state = state;
    this.emit(state);
  }

  private waitForProcessReady() {
    return new Promise((resolve, reject) => {
      if (!(this.process && this.process.stdout)) {
        return reject(new Error('No process or process not emitting logs.'));
      }

      const stdout = this.process.stdout;

      const waitForStarted = (data: Buffer) => {
        if (data.toString().includes('Serving function...')) {
          stdout.off('data', waitForStarted);
          return resolve();
        }
      }

      stdout.on("data", waitForStarted);
    });
  }
}
