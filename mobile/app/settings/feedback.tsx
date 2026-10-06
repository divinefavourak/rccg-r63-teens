import { useCallback, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import { useProfile } from '../../src/api/queries';
import { Icon } from '../../src/components/Icon';
import { useAuth } from '../../src/state/auth';
import { Object3D } from '../../src/ui/art';
import { Button } from '../../src/ui/Button';
import { ChipRow, TextField } from '../../src/ui/inputs';
import { BackHeader, KeyboardView } from '../../src/ui/screen';
import { useTokens } from '../../src/theme/ThemeProvider';

/** Where feedback goes until there is somewhere to POST it. */
const FEEDBACK_ADDRESS = 'teens@rccgregion63.org';

const KINDS = [
  { value: 'idea', label: 'An idea' },
  { value: 'problem', label: 'Something is broken' },
  { value: 'content', label: 'Something in a devotional' },
  { value: 'other', label: 'Something else' },
] as const;

type Kind = (typeof KINDS)[number]['value'];

/**
 * Give feedback.
 *
 * **There is no feedback endpoint in the backend.** Rather than invent one on
 * the client or quietly drop what a teen writes, this composes a mail draft and
 * hands it to their mail app — they can see it leave, and it lands somewhere a
 * person actually reads.
 *
 * When a `/feedback/` endpoint exists this screen keeps its shape; only `send`
 * changes, from `Linking.openURL` to a mutation.
 */
export default function FeedbackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const { user, isGuest } = useAuth();
  const profile = useProfile(!isGuest);

  const [kind, setKind] = useState<Kind>('idea');
  const [message, setMessage] = useState('');
  const [outcome, setOutcome] = useState<'opened' | 'no-mail' | null>(null);

  /**
   * Context the team needs to act on a report, gathered rather than asked for.
   *
   * A teen should never have to know their app version to report a bug.
   */
  const context = useMemo(() => {
    const parts = [
      `App: Faith Tribe ${Constants.expoConfig?.version ?? ''}`.trim(),
      `Platform: ${Platform.OS} ${Platform.Version}`,
    ];
    if (user?.username) parts.push(`Account: ${user.username}`);
    if (profile.data?.parish) parts.push(`Parish: ${profile.data.parish}`);
    return parts.join('\n');
  }, [user, profile.data]);

  const send = useCallback(async () => {
    const subject = `Faith Tribe feedback — ${KINDS.find((k) => k.value === kind)?.label ?? kind}`;
    const body = `${message}\n\n---\n${context}`;
    const url = `mailto:${FEEDBACK_ADDRESS}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;

    try {
      await Linking.openURL(url);
      setOutcome('opened');
    } catch {
      // No mail app on this phone. The address stays on screen so the teen can
      // still write from wherever they do read mail.
      setOutcome('no-mail');
    }
  }, [kind, message, context]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings'));

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader title="Give feedback" onBack={back} />

      <KeyboardView>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
        >
          <View className="flex-row items-center gap-3">
            <View className="flex-1 gap-2">
              <Text
                accessibilityRole="header"
                className="font-ui-xb text-[32px] leading-10 tracking-[-0.64px] text-ink-1"
              >
                Tell us
              </Text>
              <Text className="font-ui text-[16px] leading-6 text-ink-2">
                What would make Faith Tribe better? We read everything.
              </Text>
            </View>
            <View className="h-[88px] w-[88px] items-center justify-center rounded-full bg-pop-sky">
              <Object3D name="chat-bubble" size={72} />
            </View>
          </View>

          <View className="gap-2">
            <Text className="font-ui-sb text-[14px] leading-5 text-ink-2">What is this about?</Text>
            <ChipRow wrap options={KINDS} value={kind} onChange={setKind} />
          </View>

          <TextField
            label="Your message"
            value={message}
            onChange={setMessage}
            multiline
            placeholder="Whatever is on your mind"
          />

          {outcome && (
            <View
              accessibilityLiveRegion="polite"
              className={`w-full flex-row items-start gap-3 rounded-xl p-4 ${
                outcome === 'opened' ? 'bg-green-tonal' : 'bg-amber-tonal'
              }`}
            >
              <Icon
                name={outcome === 'opened' ? 'check' : 'info'}
                size={20}
                color={outcome === 'opened' ? tokens.green : tokens.caution}
              />
              <Text className="flex-1 font-ui text-[14px] leading-5 text-ink-1">
                {outcome === 'opened'
                  ? 'Your mail app has the message ready. Send it from there and it will reach us.'
                  : `This phone has no mail app set up. Write to ${FEEDBACK_ADDRESS} from any email instead.`}
              </Text>
            </View>
          )}

          <View className="w-full flex-row items-start gap-3 rounded-xl bg-surf-sunken p-4">
            <Icon name="mail" size={20} color={tokens.text1} />
            <View className="flex-1 gap-0.5">
              <Text className="font-ui-sb text-[16px] leading-6 text-ink-1">
                Prefer to write directly?
              </Text>
              <Text selectable className="font-ui text-[14px] leading-5 text-ink-2">
                {FEEDBACK_ADDRESS}
              </Text>
              <Text className="pt-1 font-ui-md text-[12px] leading-4 text-ink-3">
                Your app version and parish go with the message, so we can find the problem.
                Nothing else does.
              </Text>
            </View>
          </View>
        </ScrollView>

        <View className="px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          <Button
            label="Send feedback"
            onPress={send}
            disabled={message.trim().length < 3}
            className="w-full"
          />
        </View>
      </KeyboardView>
    </View>
  );
}
