import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { LeafMark } from '../src/components/BrandMarks';
import { Button } from '../src/components/ui';
import { useTokens } from '../src/theme/ThemeProvider';

/**
 * Catch-all for a deep link that no longer resolves.
 *
 * 05-navigation.md: "never trap the user" — a dead link lands on a working
 * back path into Today, not on a stack with nowhere to go. Links get forwarded
 * on WhatsApp for months, so this screen will be seen.
 */
export default function NotFoundScreen() {
  const router = useRouter();
  const tokens = useTokens();

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-surf-base px-8">
      <View className="h-20 w-20 items-center justify-center rounded-xl bg-green/10">
        <LeafMark size={40} color={tokens.green} />
      </View>
      <Text className="text-center font-ui-b text-[20px] text-ink-1">
        We couldn't find that page
      </Text>
      <Text className="text-center font-ui text-[14px] leading-[22px] text-ink-3">
        The link may be old, or the thing it pointed to may have moved.
      </Text>
      <Button label="Go to Today" onPress={() => router.replace('/')} height={48} />
    </View>
  );
}
