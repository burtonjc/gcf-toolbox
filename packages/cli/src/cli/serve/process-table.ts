import GooglePubSubEmulator from '@gcf-tools/gcloud-pubsub-emulator';
import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

import { DashboardElementController } from './dashboard';
import { LocalFunction } from './local-function';

export class ProcessTable implements DashboardElementController {
  #activeProcessSubj: BehaviorSubject<GooglePubSubEmulator | LocalFunction>;
  #emulator: GooglePubSubEmulator;
  #functions: LocalFunction[];
  #processTableElement: contrib.Widgets.TableElement;

  constructor(
    processTableElement: contrib.Widgets.TableElement,
    emulator: GooglePubSubEmulator,
    functions: LocalFunction[]
  ) {
    this.#processTableElement = processTableElement;
    this.#emulator = emulator;
    this.#functions = functions.sort();
    this.#activeProcessSubj = new BehaviorSubject<
      GooglePubSubEmulator | LocalFunction
    >(this.#emulator);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processTableList = (this.#processTableElement as any)
      .rows as blessed.Widgets.ListElement;

    processTableList.on('select', (item, index) => {
      if (index === 0) {
        this.#activeProcessSubj.next(this.#emulator);
      } else {
        const fn = this.#functions[index - 1]; // - 1 because emulator is first in data array
        this.#activeProcessSubj.next(fn);
      }
    });

    processTableElement.focus();
  }

  get activeProcess$() {
    return this.#activeProcessSubj.asObservable();
  }

  get updated$() {
    return combineLatest([
      this.#emulator.state$,
      ...this.#functions.map((f) => f.state$),
    ]).pipe(
      map(([emulatorState, ...fnStates]) => {
        const data = this.#functions.map<[string, string, string]>((fn, i) => [
          fn.name,
          fnStates[i],
          `${fn.port || '----'}`,
        ]);

        data.unshift([
          `PubSub Emulator`,
          emulatorState,
          `${this.#emulator.port || '----'}`,
        ]);

        this.#processTableElement.setData({
          data,
          headers: ['Process', 'State', 'Port'],
        });
      })
    );
  }
}
