import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { usePushPermission } from '../state/push';
import { Object3D } from '../ui/art';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/screen';

/**
 * "Want a gentle nudge each day?", asked once, at the end of joining.
 *
 * The phone only lets an app show its own permission dialog once. Asked cold,
 * a dialog reading "Allow Faith Tribe to send notifications?" gets a reflexive
 * no, and after that the only way back is through the phone's settings. So the
 * app asks in its own words first, says what will arrive and that it can be
 * turned off, and only shows the system dialog to someone who has already said
 * yes. A "Not now" here costs nothing: the question can be put again later
 * from the notification screens.
 *
 * Joining is the right moment for it. The teen has just decided to build a
 * daily habit, and a reminder is the help they would ask for.
 *
 * Use it where sign-up or sign-in finishes:
 *
 *     const invite = useReminderInvite(goToToday);
 *     …
 *     <Button onPress={invite.begin} />
 *     {invite.sheet}
 *
 * `begin` goes straight on when there is nothing to ask: the phone already
 * allows notifications, has already refused them, or cannot have them.
 */
export function useReminderInvite(onDone: () => void): {
  begin: () => void;
  sheet: React.ReactNode;
} {
  const { status, turnOn } = usePushPermission();
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  // Whichever way the sheet closes, moving on happens exactly once.
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    setOpen(false);
    onDone();
  }, [onDone]);

  const begin = useCallback(() => {
    if (status === 'undetermined') setOpen(true);
    else finish();
  }, [status, finish]);

  const accept = useCallback(async () => {
    setAsking(true);
    try {
      // Shows the phone's own dialog, and registers this phone on a yes.
      await turnOn();
    } finally {
      setAsking(false);
      finish();
    }
  }, [turnOn, finish]);

  const sheet = (
    <Sheet visible={open} onClose={finish}>
      <View className="w-full items-center gap-3 pt-2">
        <View className="h-[104px] w-[104px] items-center justify-center rounded-full bg-pop-amber">
          <Object3D name="bell" size={84} />
        </View>
        <Text
          accessibilityRole="header"
          className="text-center font-ui-xb text-[24px] leading-8 tracking-[-0.36px] text-ink-1"
        >
          Want a gentle nudge each day?
        </Text>
        <Text className="text-center font-ui text-[16px] leading-6 text-ink-2">
          One reminder to read, and news about events you join. It stops for the day as soon as
          you have read, and you can turn it off any time in Settings.
        </Text>
        <Button label="Yes, remind me" onPress={accept} loading={asking} className="mt-1 w-full" />
        <Button label="Not now" variant="tertiary" onPress={finish} className="w-full" />
      </View>
    </Sheet>
  );

  return { begin, sheet };
}
