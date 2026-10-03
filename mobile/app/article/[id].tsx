import { ScrollView, Share, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../../src/api/client';
import { useArticle } from '../../src/api/queries';
import { categoryLabel } from '../../src/data/library';
import { BackHeader, EmptyState, Skeleton } from '../../src/ui/screen';

/**
 * An article from the Library.
 *
 * Laid out like the daily reading, in the reader's serif, so everything a
 * teen reads at length in the app reads the same way.
 */
export default function ArticleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const query = useArticle(id);
  const article = query.data;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/library'));

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader
        title="Article"
        onBack={back}
        action={
          article
            ? {
                icon: 'shareUp',
                label: 'Share this article',
                onPress: () => {
                  Share.share({ message: `${article.title}\nFaith Tribe` }).catch(() => {});
                },
              }
            : undefined
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16) + 16,
        }}
      >
        {/* A comfortable measure on tablets and wide phones. */}
        <View className="mx-auto w-full flex-1 gap-5" style={{ maxWidth: 640 }}>
          {query.isPending ? (
            <>
              <Skeleton width={180} height={16} radius={8} />
              <Skeleton width="80%" height={32} radius={8} />
              {Array.from({ length: 7 }, (_, i) => (
                <Skeleton key={i} width={i % 3 === 2 ? '72%' : '100%'} height={18} radius={8} />
              ))}
            </>
          ) : !article ? (
            <View className="flex-1 justify-center">
              <EmptyState
                drawing="sitting"
                message={
                  query.error instanceof ApiError && query.error.status === 404
                    ? 'That article is not here any more. There is more in the Library.'
                    : 'We couldn’t load this article. Check your connection, then try again.'
                }
                actionLabel={
                  query.error instanceof ApiError && query.error.status === 404
                    ? 'Back to the Library'
                    : 'Try again'
                }
                onAction={() =>
                  query.error instanceof ApiError && query.error.status === 404
                    ? router.replace('/library')
                    : query.refetch()
                }
              />
            </View>
          ) : (
            <>
              <Text className="font-ui-md text-[12px] uppercase leading-4 text-ink-3">
                {[
                  categoryLabel(article.category),
                  article.read_time_minutes ? `${article.read_time_minutes} min read` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>

              <Text accessibilityRole="header" className="font-read-sb text-[24px] leading-8 text-ink-1">
                {article.title}
              </Text>

              {!!article.author_name && (
                <Text className="font-ui-sb text-[14px] leading-5 text-ink-2">
                  By {article.author_name}
                </Text>
              )}

              {paragraphs(article.content).map((para, i) => (
                <Text key={i} className="font-read text-[18px] leading-[30px] text-ink-1">
                  {para}
                </Text>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Article bodies come from a rich-text editor, so they may arrive as HTML.
 * This keeps the paragraph breaks and drops the markup: plain text in the
 * reader's serif is the whole design for long reading.
 */
function paragraphs(content: string | null | undefined): string[] {
  if (!content) return [];
  return content
    .replace(/<\s*(br|\/p|\/div|\/h[1-6]|\/li)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, '’')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}
