import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../src/ui/Button';
import {
  Avatar,
  Blob,
  ContentCard,
  DateBadge,
  FactChip,
  HeroCard,
  PopCard,
  PopEyebrow,
  StatTile,
  StreakCard,
  WeekPill,
} from '../../src/ui/cards';
import { ChipRow, IconField, OptionRow, StepperBar, Toggle } from '../../src/ui/inputs';
import { Object3D } from '../../src/ui/art';
import { EmptyState, IconButton, SectionTitle } from '../../src/ui/screen';
import { useTheme } from '../../src/theme/ThemeProvider';

const REGIONS = [
  { title: 'Region 63', detail: 'Lagos' },
  { title: 'Region 1', detail: 'Lagos' },
];

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'read', label: 'Read' },
  { value: 'watch', label: 'Watch' },
  { value: 'listen', label: 'Listen' },
] as const;

/**
 * Every kit component on one screen, for checking against the Figma
 * Components page in light and dark. Development builds only: in a release
 * build the route redirects home.
 */
export default function KitScreen() {
  const insets = useSafeAreaInsets();
  const { toggle, scheme } = useTheme();
  const [region, setRegion] = useState(0);
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('all');
  const [quiet, setQuiet] = useState(true);

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <View className="flex-1 bg-surf-base">
      <Blob colour="green" size={300} style={{ left: -150, top: -90 }} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 32,
          gap: 20,
        }}
      >
        <StepperBar step={5} total={8} onBack={() => {}} />

        <View className="gap-5 px-5">
          <Button label={`Theme: ${scheme}`} variant="secondary" onPress={toggle} />

          <HeroCard
            eyebrow="Today’s reading · 4 min"
            title="Standing Firm"
            detail="Ephesians 6:10–18"
            actionLabel="Read now"
            onPress={() => {}}
            drawing="reading-side"
            object="notebook"
          />

          <View className="flex-row justify-between">
            <WeekPill weekday="Sun" date={27} state="done" />
            <WeekPill weekday="Mon" date={28} state="done" />
            <WeekPill weekday="Tue" date={29} state="done" />
            <WeekPill weekday="Wed" date={30} state="done" />
            <WeekPill weekday="Thu" date={1} state="today" />
            <WeekPill weekday="Fri" date={2} state="next" />
            <WeekPill weekday="Sat" date={3} state="next" />
          </View>

          <View className="flex-row gap-3">
            <PopCard colour="violet" className="h-[224px] flex-1 gap-2">
              <PopEyebrow>Verse of the day</PopEyebrow>
              <Text className="font-ui-b text-[17px] leading-6 text-pop-on">
                “Be strong in the Lord, and in the strength of his might.”
              </Text>
              <View className="flex-1" />
              <Text className="font-ui-sb text-[12px] leading-4 text-pop-on">Ephesians 6:10</Text>
              <View pointerEvents="none" style={{ position: 'absolute', right: 12, bottom: 2 }}>
                <Object3D name="bell" size={72} />
              </View>
            </PopCard>
            <View className="flex-1 gap-3">
              <PopCard colour="sky" className="h-[140px] gap-1.5">
                <PopEyebrow>Challenge</PopEyebrow>
                <Text className="font-ui-sb text-[16px] leading-6 text-pop-on">
                  Send a friend today’s verse
                </Text>
              </PopCard>
              <PopCard colour="pink" className="h-[72px] justify-center">
                <PopEyebrow>Continue</PopEyebrow>
                <Text className="font-ui-sb text-[16px] leading-6 text-pop-on">John 3</Text>
              </PopCard>
            </View>
          </View>

          <StreakCard
            title="12-day streak"
            message="You showed up today. See you tomorrow."
            week={[
              { letter: 'M', state: 'done' },
              { letter: 'T', state: 'done' },
              { letter: 'W', state: 'done' },
              { letter: 'T', state: 'done' },
              { letter: 'F', state: 'today' },
              { letter: 'S', state: 'next' },
              { letter: 'S', state: 'next' },
            ]}
          />

          <View className="gap-3">
            {REGIONS.map((r, i) => (
              <OptionRow
                key={r.title}
                title={r.title}
                detail={r.detail}
                selected={region === i}
                onPress={() => setRegion(i)}
              />
            ))}
          </View>

          <IconField
            icon="phone"
            label="Phone number or email"
            value={contact}
            onChange={setContact}
          />
          <IconField icon="lock" label="Password" value={password} onChange={setPassword} secure />

          <SectionTitle actionLabel="See all" onAction={() => {}}>
            Tab screens
          </SectionTitle>

          <View className="flex-row items-center gap-3">
            <IconButton icon="search" label="Search" onPress={() => {}} />
            <IconButton icon="bell" label="Notifications" dot onPress={() => {}} />
            <Avatar name="Tolu Adeyemi" size={56} ring={3} />
            <DateBadge date={new Date()} colour="violet" />
            <Toggle on={quiet} onChange={setQuiet} label="Quiet hours" />
          </View>

          <ChipRow options={FILTERS} value={filter} onChange={setFilter} />

          <View className="flex-row flex-wrap gap-2">
            <FactChip icon="calendar" colour="amber">
              Sat 12 Dec · 10:00 am
            </FactChip>
            <FactChip icon="mapPin" colour="sky">
              Rehoboth Parish, Ikeja
            </FactChip>
          </View>

          <View className="mt-2 flex-row" style={{ gap: 10 }}>
            <StatTile value="48" label="Days read" colour="amber" object="fire" />
            <StatTile value="12" label="Chapters" colour="sky" object="notebook" />
            <StatTile value="6" label="Saved" colour="pink" object="star" />
          </View>

          <ContentCard
            eyebrow="Article · 5 min read"
            title="When your friends don’t believe what you believe"
            detail="Relationships"
            colour="amber"
            drawing="sitting-reading"
            onPress={() => {}}
          />

          <EmptyState
            drawing="plant"
            message="Nothing saved yet. Tap the bookmark on anything you want to keep."
            actionLabel="Browse the Library"
            onAction={() => {}}
          />

          <Button label="Continue" onPress={() => {}} />
          <Button label="Continue" variant="secondary" onPress={() => {}} />
          <Button label="I am not sure of my region" variant="tertiary" onPress={() => {}} />
          <Button label="Continue" disabled />
          <Button label="Continue" loading />
        </View>
      </ScrollView>
    </View>
  );
}
