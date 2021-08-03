import { mkdtempSync } from 'fs';
import { rmdirSync } from 'fs';
import { Socket } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';

import Emulator from '../src/gcloud-pubsub-emulator';

export interface SetupOpts {
  /**
   * Enable debug logging on the emulator.
   *
   * @defaultValue `false`
   */
  debug?: boolean;

  /**
   * Weather or not the emulator should be started as a part of the setup. If
   * `false` the emulator can be started manually by running
   * `emulatorTestingEnvironment.emulator.start()`.
   *
   * @defaultValue `true`
   */
  start?: boolean;
}

export class EmulatorTestingEnvironment {
  private dataDir?: string;
  private _emulator?: Emulator;
  private port?: number;

  async setup(opts: SetupOpts = {}) {
    const debug = opts.debug ?? false;
    const start = opts.start ?? true;

    if (this.emulator) {
      return;
    }

    this.port = await getAvailablePort();
    this.dataDir = mkdtempSync(join(tmpdir(), `pubsub-emulator-${this.port}-`));
    this._emulator = new Emulator({
      dataDir: this.dataDir,
      debug,
      hostPort: `localhost:${this.port}`,
    });

    if (start) {
      await this._emulator.start();
    }
  }

  async teardown() {
    if (!(this.emulator && this.dataDir && this.port)) {
      return Promise.resolve();
    }

    await this.emulator.stop();
    rmdirSync(this.dataDir);

    delete this.port;
    delete this.dataDir;
    delete this._emulator;
  }

  public get emulator() {
    return this._emulator;
  }
}

const getAvailablePort = async () => {
  let port: number | null = null;
  while (!port) {
    port = Math.floor(Math.random() * 10000);

    if (!(await isPortAvailable(port))) {
      port = null;
    }
  }

  return port;
};

const isPortAvailable = (port: number) => {
  const cleanUp = (sock: Socket) => {
    if (sock) {
      sock.removeAllListeners('connect');
      sock.removeAllListeners('error');
      sock.end();
      sock.destroy();
      sock.unref();
    }
  };

  return new Promise<boolean>((resolve, reject) => {
    const sock = new Socket();
    sock
      .once('connect', () => {
        // This means something is listening on that port
        resolve(false);
        cleanUp(sock);
      })
      .once('error', (err) => {
        if (err.message.includes('ECONNREFUSED')) {
          // This means nothing is listening on that port ... aka it is available
          resolve(true);
        } else {
          // This is unexpected
          reject(err);
        }
        cleanUp(sock);
      });
    sock.connect({ host: 'localhost', port });
  });
};
