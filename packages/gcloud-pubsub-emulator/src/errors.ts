export class EmulatorNotInitializedError extends Error {
  message = 'Emulator not initialized.';
}

export class PortAlreadyInUseError extends Error {
  message = 'Emulator already running.';
}
