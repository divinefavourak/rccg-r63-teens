import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import { Icon } from '../../src/components/Icon';
import { Button, Card } from '../../src/components/ui';
import { SelectField, TextField } from '../../src/components/form';
import { useTokens } from '../../src/theme/ThemeProvider';
import { useAuth } from '../../src/state/auth';
import { useProfile } from '../../src/api/queries';

/** Where feedback goes until there is somewhere to POST it. */
const FEEDBACK_ADDRESS = 'teens@rccgregion63.org';

const KINDS = [
  { value: 'idea', label: 'An idea' },
  { value: 'problem', label: 'Something is broken' },
  { value: 'content', label: 'Something in a devotional' },
  { value: 'other', label: 'Something else' },
];

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

  const [kind, setKind] = useState('idea');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

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

    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      // No mail app configured. Say so plainly and leave the address visible so
      // the teen can still act on it.
      setSent(false);
      return;
    }

    await Linking.openURL(url);
    setSent(true);
  }, [kind, message, context]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surf-base"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        className="flex-row items-center gap-3 border-b border-line bg-surf-raised px-4 pb-3.5"
        style={{ paddingTop: insets.top + 10 }}
      >
        <Pressable
          onPress={router.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-md border border-line"
        >
          <Icon name="chevronLeft" size={20} color={tokens.text2} />
        </Pressable>
        <Text className="flex-1 font-ui-b text-[16px] text-ink-1">Give feedback</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text className="mb-5 font-ui text-[14px] leading-[21px] text-ink-2">
          Tell us what would make Faith Tribe better. We read everything.
        </Text>

        <SelectField
          label="What is this about?"
          required
          value={kind}
          options={KINDS}
          onChange={setKind}
        />

        <TextField
          label="Your message"
          required
          value={message}
          onChange={setMessage}
          multiline
          placeholder="Whatever is on your mind…"
        />

        {sent && (
          <Card className="mb-4 flex-row items-start gap-3 p-4">
            <Icon name="check" size={18} color={tokens.green} />
            <Text className="flex-1 font-ui text-[13px] leading-[19px] text-ink-2">
              Your mail app is open with the message ready. Send it from there and we will
              get it.
            </Text>
          </Card>
        )}

        <Card className="flex-row items-start gap-3 p-4">
          <Icon name="chat" size={18} color={tokens.text3} />
          <View className="flex-1">
            <Text className="font-ui-sb text-[13px] text-ink-1">Prefer to write directly?</Text>
            <Text className="mt-0.5 font-ui text-[13px] leading-[19px] text-ink-2">
              {FEEDBACK_ADDRESS}
            </Text>
            <Text className="mt-2 font-ui text-[12px] leading-[17px] text-ink-3">
              We attach your app version and parish so we can find the problem — nothing
              else.
            </Text>
          </View>
        </Card>
      </ScrollView>

      <View
        className="border-t border-line bg-surf-raised px-5 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <Button
          label="Send feedback"
          onPress={send}
          disabled={message.trim().length < 3}
          height={52}
          icon={<Icon name="arrowRight" size={18} color="#fff" />}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
