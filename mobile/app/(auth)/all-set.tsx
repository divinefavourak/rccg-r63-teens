import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RccgLogo } from '../../src/components/Logo';
import { useReminderInvite } from '../../src/components/ReminderInvite';
import { useAuth } from '../../src/state/auth';
import { CHURCH_STEPS, deepestChurch, useSignUp } from '../../src/state/signup';
import { markWelcomed } from '../../src/state/welcome';
import { Drawing, Object3D } from '../../src/ui/art';
import { Button } from '../../src/ui/Button';
import { Blob } from '../../src/ui/cards';

/**
 * The account exists. One celebration, the church they joined, and straight
 * into today's reading — the habit starts on the same screen the sign-up ends.
 */
export default function AllSetScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { form, reset } = useSignUp();

  const church = deepestChurch(form);
  // "Ikeja Zone · Province 69 · Region 63": everything above the chosen node,
  // nearest first.
  const above = CHURCH_STEPS.map((level) => form.church[level])
    .filter((node) => node && node.id !== church?.id)
    .map((node) => node!.name)
    .reverse()
    .join(' · ');

  const start = useCallback(() => {
    markWelcomed();
    reset();
    // Drop the whole sign-up stack: Back from Today must not return to it.
    router.dismissTo('/');
  }, [reset, router]);

  // The last step of joining: offer a daily reminder, then on to the reading.
  const invite = useReminderInvite(start);

  return (
    <View className="flex-1 bg-pop-green" style={{ paddingTop: insets.top }}>
      <StatusBar style="dark" />
      <Blob colour="lime" size={380} style={{ left: -140, top: -100 }} />

      <View className="flex-1 items-center justify-center overflow-hidden">
        <View style={{ width: 360, height: 400, alignItems: 'center', justifyContent: 'center' }}>
          <Drawing name="jumping" width={252} />
          <View pointerEvents="none" style={{ position: 'absolute', left: 228, top: 30 }}>
            <Object3D name="trophy" size={110} />
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', left: 28, top: 40 }}>
            <Object3D name="star" size={72} />
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', left: 30, top: 250 }}>
            <Object3D name="rocket" size={84} />
          </View>
        </View>
      </View>

      <View
        className="items-center gap-4 rounded-t-[40px] bg-surf-raised px-6 pt-7"
        style={{ paddingBottom: Math.max(insets.bottom, 24) }}
      >
        <Text
          accessibilityRole="header"
          className="text-center font-ui-xb text-[32px] leading-10 tracking-[-0.64px] text-ink-1"
        >
          You’re in, {user?.first_name || form.firstName.trim() || 'friend'}!
        </Text>
        <Text className="text-center font-ui text-[16px] leading-6 text-ink-2">
          Welcome to the tribe.
        </Text>

        {church && (
          <View className="w-full flex-row items-center gap-3 rounded-xl bg-green-tonal py-3 pl-3 pr-4">
            <RccgLogo size={44} />
            <View className="flex-1">
              <Text numberOfLines={1} className="font-ui-sb text-[16px] leading-6 text-ink-1">
                {church.name}
              </Text>
              {above.length > 0 && (
                <Text numberOfLines={1} className="font-ui-md text-[12px] leading-4 text-ink-2">
                  {above}
                </Text>
              )}
            </View>
          </View>
        )}

        <Button label="Start today’s reading" onPress={invite.begin} className="w-full" />
      </View>
      {invite.sheet}
    </View>
  );
}
