import Emulator, { EmulatorStates } from './gcloud-pubsub-emulator';

describe('gcloud-pubsub-emulator', () => {
  const emulator = new Emulator({
    project: 'fake-test-project',
  });

  describe('#start', () => {
    afterEach(() => emulator.stop());

    it('resolves after emulator starts', async () => {
      let state: EmulatorStates | null = null;
      const stateSub = emulator.state$.subscribe((s) => (state = s));

      expect(state).toEqual(EmulatorStates.Stopped);

      const promise = emulator.start();

      expect(state).toEqual(EmulatorStates.Starting);

      await promise;

      expect(state).toEqual(EmulatorStates.Running);

      stateSub.unsubscribe();
    });

    it('sets emulator environment variables', async () => {
      await emulator.start();

      expect(process.env.PUBSUB_EMULATOR_HOST).toBeDefined();
    });

    it.todo('fails helpfully if emulator is not installed');
  });

  describe('#stop', () => {
    it('resolves after emulator has shut down', async () => {
      await emulator.start();

      const state = await emulator.stop();

      expect(state).toBe(EmulatorStates.Stopped);
    });

    it('resolves if emulator was not already running', async () => {
      const state = await emulator.stop();

      expect(state).toBe(EmulatorStates.Stopped);
    });

    it('removes emulator environment variables', async () => {
      await emulator.start();
      await emulator.stop();

      expect(process.env.PUBSUB_EMULATOR_HOST).toBeUndefined();
    });
  });
});
