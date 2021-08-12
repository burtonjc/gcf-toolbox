import GooglePubSubEmulator from '@gcf-tools/gcloud-pubsub-emulator';
import { Subscription as PubSubSubscription } from '@google-cloud/pubsub';
import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { merge, Observable } from 'rxjs';

import { LocalFunction } from './local-function';
import { ProcessLog } from './process-log';
import { ProcessTable } from './process-table';

export class Dashboard {
  private screen = blessed.screen();
  private subscriptionTable?: contrib.Widgets.TableElement;

  constructor(
    private emulator: GooglePubSubEmulator,
    private functions: LocalFunction[]
  ) {}

  public start() {
    const grid = new contrib.grid({
      rows: 1 + Math.ceil(this.functions.length / 2),
      cols: 2,
      screen: this.screen,
    });

    this.screen.key(['escape', 'q', 'C-c'], async (ch, key) => {
      await this.stop();
    });

    const processTableEl = grid.set(0, 0, 1, 1, contrib.table, {
      border: { type: 'line', fg: 'cyan' },
      columnSpacing: 4,
      columnWidth: [16, 8, 4],
      fg: 'grey',
      label: ' Active Processes ',

      mouse: true,
      keys: true,
      selectedBg: 'blue',
      selectedFg: 'white',
      vi: true,
    } as contrib.Widgets.TableOptions);
    const processTable = new ProcessTable(
      processTableEl,
      this.emulator,
      this.functions
    );

    const processLogEl = grid.set(1, 0, 1, 2, contrib.log, {
      mouse: true,
      keys: true,
      scrollable: true,
      alwaysScroll: true,
      baseLimit: 10,
      bufferLength: Infinity,
      scrollbar: {
        ch: ' ',
        inverse: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any, // TODO: PR to fix these typings
      interactive: true,
    } as contrib.Widgets.LogOptions);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (processLogEl as any).interactive = true; // TODO: PR to fix these typings
    const processLog = new ProcessLog(processLogEl);

    processTable.activeProcess$.subscribe((ps) => {
      processLog.process = ps;
    });

    merge(processTable.updated$, processLog.updated$).subscribe(() => {
      this.screen.render();
    });

    this.subscriptionTable = grid.set(0, 1, 1, 1, contrib.table, {
      border: { type: 'line', fg: 'cyan' },
      columnWidth: [12, 60],
      fg: 'grey',
      interactive: false as any,
      label: ' Push Subscriptions ',
    } as contrib.Widgets.TableOptions);
    this.subscriptionTable.setData({
      data: [],
      headers: ['Topic', 'Push URL'],
    });

    this.screen.render();
  }

  public set pushSubscriptions(subscriptions: PubSubSubscription[]) {
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

export interface DashboardElementController {
  updated$: Observable<void>;
}
