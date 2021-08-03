import GooglePubSubEmulator from '@gcf-tools/gcloud-pubsub-emulator';
import { Subscription } from '@google-cloud/pubsub';
import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { merge } from 'rxjs';

import { LocalFunction } from './local-function';

export class Dashboard {
  private screen = blessed.screen();

  private processTable?: contrib.Widgets.TableElement;
  private subscriptionTable?: contrib.Widgets.TableElement;

  constructor(
    private emulator: GooglePubSubEmulator,
    private functions: LocalFunction[]
  ) {}

  public start() {
    const grid = new contrib.grid({ rows: 4, cols: 2, screen: this.screen });
    this.screen.key(['escape', 'q', 'C-c'], async (ch, key) => {
      await this.stop();
    });
    this.screen.render();

    this.processTable = grid.set(0, 0, 1, 1, contrib.table, {
      border: { type: 'line', fg: 'cyan' },
      columnSpacing: 4,
      columnWidth: [16, 8, 4],
      fg: 'grey',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      interactive: false as any,
      label: ' Active Processes ',
    } as contrib.Widgets.TableOptions);

    merge(
      this.emulator.state$,
      ...this.functions.map((f) => f.state)
    ).subscribe(() => {
      const data = this.functions.map((fn) => [
        fn.name,
        fn.currentState,
        `${fn.port}`,
      ]);
      data.unshift([
        'PubSub Emulator',
        this.emulator.currentState,
        `${this.emulator.port || '----'}`,
      ]);
      this.processTable?.setData({
        data,
        headers: ['Process', 'State', 'Port'],
      });
      this.screen.render();
    });

    this.subscriptionTable = grid.set(0, 1, 1, 1, contrib.table, {
      border: { type: 'line', fg: 'cyan' },
      // columnSpacing: 4,
      columnWidth: [12, 30],
      fg: 'grey',
      interactive: false as any,
      // keys: true,
      label: ' Push Subscriptions ',
      // vi: true,
    } as contrib.Widgets.TableOptions);
    this.subscriptionTable.setData({
      data: [],
      headers: ['Topic', 'Push URL'],
    });

    const emulatorLog = grid.set(1, 0, 1, 2, contrib.log, {
      label: 'PubSub Emulator Log',
    } as contrib.Widgets.LogOptions);
    this.emulator.log.on('data', (chunk: Buffer) => {
      emulatorLog.log(chunk.toString());
    });

    this.functions.forEach((f, idx) => {
      const row = 2 + Math.floor(idx / 2);
      const column = (idx + 2) % 2;
      const functionLog = grid.set(row, column, 1, 1, contrib.log, {
        label: `${f.name} Log`,
      } as contrib.Widgets.LogOptions);
      f.log.on('data', (chunk: Buffer) => {
        functionLog.log(chunk.toString());
      });
    });

    this.screen.render();
  }

  public set pushSubscriptions(subscriptions: Subscription[]) {
    this.subscriptionTable?.setData({
      headers: ['Topic', 'URL'],
      data: subscriptions.map((s) => [
        s.metadata?.topic?.split('/').pop() as string,
        s.metadata?.pushConfig?.pushEndpoint as string,
      ]),
    });

    this.screen.render();
  }

  public async stop() {
    await Promise.all(this.functions.map((fn) => fn.stop()));
    await this.emulator.stop();

    setTimeout(() => {
      this.screen.destroy();
    }, 500);
  }
}
