import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useInstall } from '../state/install';
import { PopCard } from '../ui/cards';
import { Press } from '../ui/Press';
import { POP } from '../theme/tokens';
import { Icon } from './Icon';

const DISMISSED_KEY = 'faithtribe.installHintDismissed';

/**
 * "Add Faith Tribe to your Home Screen", for someone reading in a browser tab.
 *
 * Only ever shown on the web, and only where installing is possible and has
 * not been done; in the app itself `useInstall` reports nothing to offer.
 *
 * An iPhone has no button a page can press for this. The teen has to open
 * Safari's Share menu themselves, so the card says exactly where to tap. It is
 * worth the space on Today: until the site is on the Home Screen, an iPhone
 * will not let it send reminders, and may clear what it has saved.
 */
export function InstallHint() {
  const { way, install } = useInstall();
  // Null until the saved answer is read, so the card never flashes up and away.
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!way) return;
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((value) => setDismissed(value !== null))
      .catch(() => setDismissed(false));
  }, [way]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    AsyncStorage.setItem(DISMISSED_KEY, String(Date.now())).catch(() => {});
  }, []);

  if (!way || dismissed !== false) return null;

  return (
    <PopCard colour="amber" className="w-full gap-3">
      <View className="flex-row items-start gap-3">
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="font-ui-sb text-[16px] leading-6 text-pop-on">
            Add Faith Tribe to your Home Screen
          </Text>
          {way === 'share-menu' ? (
            <Text className="font-ui text-[14px] leading-5 text-pop-on">
              Tap <Icon name="shareUp" size={15} color={POP.on} /> Share in your browser, then “Add
              to Home Screen”. It opens like an app, works with no signal and can send your
              reminders.
            </Text>
          ) : (
            <Text className="font-ui text-[14px] leading-5 text-pop-on">
              It opens like an app, works with no signal and can send your reminders.
            </Text>
          )}
        </View>
        <Press
          onPress={dismiss}
          accessibilityLabel="Dismiss"
          className="h-11 w-11 items-center justify-center"
        >
          <Icon name="close" size={20} color={POP.on} />
        </Press>
      </View>
      {way === 'dialog' && (
        // Always dark with light text: it sits on amber in both themes.
        <Press
          onPress={install}
          accessibilityLabel="Install Faith Tribe"
          className="h-11 items-center justify-center self-start rounded-full bg-pop-on px-5"
        >
          <Text className="font-ui-sb text-[14px] leading-5" style={{ color: '#FDFAF5' }}>
            Install
          </Text>
        </Press>
      )}
    </PopCard>
  );
}
