import GooglePubSubEmulator from '@gcf-tools/gcloud-pubsub-emulator';
import { PubSub, Subscription, Topic } from '@google-cloud/pubsub';
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
    private functions: LocalFunction[],
  ) { }

  public start() {
    const grid = new contrib.grid({ rows: 4, cols: 2, screen: this.screen });
    this.screen.key(['escape', 'q', 'C-c'], async (ch, key) => {
      await this.stop();
    });
    this.screen.render();

    this.processTable = grid.set(0, 0, 1, 1, contrib.table, {
      border: { type: "line", fg: "cyan" },
      columnSpacing: 4,
      columnWidth: [16, 8, 4],
      fg: 'grey',
      interactive: false as any,
      // keys: true,
      label: ' Active Processes a',
      // vi: true,
    } as contrib.Widgets.TableOptions);

    // processesTable.focus();

    merge(
      this.emulator.state,
      ...this.functions.map(f => f.state)
    ).subscribe(() => {
      const data = this.functions.map((fn) => [
        fn.name,
        fn.currentState,
        `${fn.port}`
      ]);
      data.unshift([
        'PubSub Emulator',
        this.emulator.currentState,
        `${this.emulator.port || '----'}`
      ]);
      this.processTable?.setData({
        data,
        headers: ['Process', 'State', 'Port'],
      });
      this.screen.render();
    });

    this.subscriptionTable = grid.set(0, 1, 1, 1, contrib.table, {
      border: { type: "line", fg: "cyan" },
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

    // const pubSubBars = grid.set(0, 1, 1, 1, contrib.stackedBar, {
    //   barBgColor: ['green', 'white'] as any,
    //   barSpacing: 0,
    //   barWidth: 2,
    //   label: 'PubSub Subscriptions',
    // } as contrib.Widgets.StackedBarOptions);

    // pubSubBars.setData({
    //   barCategory: ['sub-1', 'sub-2', 'sub-3', 'sub-4']
    //   , stackedCategory: ['Unack\'d', 'Ack\'d',]
    //   , data:
    //     [
    //       [2, 4],
    //       [0, 2],
    //       [1, 3],
    //       [0, 0],
    //     ]
    // });

    this.screen.render();
  }

  public set pushSubscriptions(subscriptions: Subscription[]) {
    this.subscriptionTable?.setData({
      headers: [ 'Topic', 'URL' ],
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