import { Platform, Text, View } from 'react-native';

import { usePushPermission } from '../state/push';
import { Object3D } from '../ui/art';
import { Press } from '../ui/Press';

/**
 * "Turn on notifications on this phone".
 *
 * Shown only while there is something to do: nothing once the phone allows
 * notifications, and nothing where it never could (the web preview). The app
 * asks here, on a screen about notifications, and never at launch, so the
 * system's one-time dialog appears when the teen already knows what they are
 * saying yes to.
 */
export function PushPrompt() {
  const { status, turnOn } = usePushPermission();

  if (status !== 'undetermined' && status !== 'denied') return null;
  const refused = status === 'denied';

  return (
    <View className="w-full flex-row items-center gap-3 rounded-2xl bg-pop-amber py-3 pl-3 pr-3">
      <Object3D name="bell" size={48} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-ui-sb text-[16px] leading-6 text-pop-on">
          {refused ? 'Notifications are off' : 'Get reminders on this phone'}
        </Text>
        <Text className="font-ui text-[14px] leading-5 text-pop-on">
          {refused
            ? 'Turn them on for Faith Tribe in your phone’s settings.'
            : 'A gentle nudge to read, and news about your events.'}
        </Text>
      </View>
      {/* Always dark with light text: it sits on amber in both themes. A
          browser has no settings screen a page can open, so after a refusal
          there the words stand alone. */}
      {!(refused && Platform.OS === 'web') && (
        <Press
          onPress={turnOn}
          accessibilityLabel={refused ? 'Open phone settings' : 'Turn on notifications'}
          className="h-11 items-center justify-center rounded-full bg-pop-on px-4"
        >
          <Text className="font-ui-sb text-[14px] leading-5" style={{ color: '#FDFAF5' }}>
            {refused ? 'Settings' : 'Turn on'}
          </Text>
        </Press>
      )}
    </View>
  );
}
