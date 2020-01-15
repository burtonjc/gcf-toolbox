import GooglePubSubEmulator from '@gcf-tools/gcloud-pubsub-emulator';
import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { merge } from 'rxjs';

import { LocalFunction } from './local-function';

export class Dashboard {
  private screen = blessed.screen();

  constructor(
    private emulator: GooglePubSubEmulator,
    private functions: LocalFunction[],
  ) {}

  public start() {
    const grid = new contrib.grid({ rows: 4, cols: 2, screen: this.screen });
    this.screen.key(['escape', 'q', 'C-c'], async (ch, key) => {
      await this.stop();
    });
    this.screen.render();

    const processesTable = grid.set(0, 0, 1, 1, contrib.table, {
      border: { type: "line", fg: "cyan" },
      columnSpacing: 4,
      columnWidth: [16, 8, 4],
      fg: 'grey',
      interactive: false as any,
      // keys: true,
      label: 'Active Processes',
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
      processesTable.setData({
        data,
        headers: ['Process', 'State', 'Port'],
      });
      this.screen.render();
    });

    // bar = contrib.stackedBar(
    //   {
    //     label: 'Server Utilization (%)'
    //     , barWidth: 4
    //     , barSpacing: 6
    //     , xOffset: 0
    //     //, maxValue: 15
    //     , height: "40%"
    //     , width: "50%"
    //     , barBgColor: ['red', 'blue', 'green']
    //   });
    const pubSubBars = grid.set(0, 1, 1, 1, contrib.stackedBar, {
      barBgColor: ['green', 'white'] as any,
      barSpacing: 0,
      barWidth: 2,
      label: 'PubSub Subscriptions',
    } as contrib.Widgets.StackedBarOptions);

    pubSubBars.setData({
      barCategory: ['sub-1', 'sub-2', 'sub-3', 'sub-4']
      , stackedCategory: ['Unack\'d', 'Ack\'d',]
      , data:
        [
          [2, 4],
          [0, 2],
          [1, 3],
          [0, 0],
        ]
    });

    this.screen.render();
  }

  public async stop() {
    await Promise.all([
      ...this.functions.map((fn) => fn.stop()),
    ]);
    await this.emulator.stop(),

    setTimeout(() => {
      this.screen.destroy();
    }, 500);
  }
}