import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'faithtribe.welcomed';

/**
 * Whether this device has been past the welcome pages.
 *
 * Plain AsyncStorage: it is a "have we met" flag, not a credential. The value
 * is read once at launch (`loadWelcomed`, awaited behind the splash screen)
 * and cached, so a layout can ask `needsWelcome()` synchronously while
 * rendering instead of flashing Today and then redirecting.
 */
let welcomed: boolean | null = null;

export async function loadWelcomed(): Promise<void> {
  try {
    welcomed = (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    // A storage error must never trap someone on the welcome pages at every
    // launch, so a failed read counts as "already welcomed".
    welcomed = true;
  }
}

/** True only on a device that has never been past the welcome pages. */
export function needsWelcome(): boolean {
  return welcomed === false;
}

export function markWelcomed(): void {
  welcomed = true;
  AsyncStorage.setItem(KEY, '1').catch(() => {
    // Worst case the welcome shows once more.
  });
}
