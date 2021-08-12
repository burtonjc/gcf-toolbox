import GooglePubSubEmulator from '@gcf-tools/gcloud-pubsub-emulator';
import contrib from 'blessed-contrib';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';

import { DashboardElementController } from './dashboard';
import { LocalFunction } from './local-function';

export class ProcessLog implements DashboardElementController {
  #process$ = new BehaviorSubject<GooglePubSubEmulator | LocalFunction | null>(
    null
  );
  #logSub?: Subscription;

  constructor(private logElement: contrib.Widgets.LogElement) {
    this.#process$.subscribe();
  }

  set process(ps: GooglePubSubEmulator | LocalFunction) {
    if (this.#logSub) {
      this.#logSub.unsubscribe();
    }
    this.#process$.next(ps);
    this.#logSub = ps.log$?.subscribe((line) => {
      this.logElement.log(line);
    });
  }

  get updated$(): Observable<void> {
    return this.#process$.asObservable().pipe(
      map((ps) => {
        (this.logElement as any).logLines = [];
        this.logElement.setItems([]);
        if (ps) {
          this.logElement.setLabel(` ${ps.name} Log `);
        } else {
          this.logElement.setLabel(` ----- `);
        }
      })
    );
  }
}
