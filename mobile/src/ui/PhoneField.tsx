import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Icon } from '../components/Icon';
import { COUNTRIES, flag, type Country } from '../data/countries';
import { INPUT_RESET, SearchField } from './inputs';
import { Press } from './Press';
import { Sheet } from './screen';
import { useTokens } from '../theme/ThemeProvider';
import { POP } from '../theme/tokens';

/**
 * Phone number with a country you can change.
 *
 * The chip on the left opens a searchable list. The number on the right is the
 * national part only — the country code is added when the form is submitted
 * (see `toE164`), so the teen never has to know what "+234" replaces.
 */
export function PhoneField({
  country,
  onCountry,
  value,
  onChange,
}: {
  country: Country;
  onCountry: (country: Country) => void;
  value: string;
  onChange: (value: string) => void;
}) {
  const tokens = useTokens();
  const [focused, setFocused] = useState(false);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRIES;
    // Match the name, or the code with or without its plus.
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q.replace(/^\+?/, '+')),
    );
  }, [search]);

  const close = () => {
    setPicking(false);
    setSearch('');
  };

  return (
    <View className="w-full gap-2">
      <Text className="font-ui-sb text-[14px] leading-5 text-ink-2">Phone number</Text>
      <View className="flex-row gap-2">
        <Press
          onPress={() => setPicking(true)}
          accessibilityLabel={`Country: ${country.name}, ${country.dial}. Change country`}
          className="h-[60px] flex-row items-center gap-1 rounded-xl bg-surf-sunken pl-4 pr-2.5"
        >
          <Text className="font-ui-sb text-[16px] leading-6 text-ink-1">
            {flag(country.iso)} {country.dial}
          </Text>
          <Icon name="chevronDown" size={16} color={tokens.text2} />
        </Press>
        <View
          className={`h-[60px] flex-1 flex-row items-center rounded-xl border-2 bg-surf-sunken px-5 ${
            focused ? 'border-ink' : 'border-transparent'
          }`}
        >
          <TextInput
            value={value}
            onChangeText={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={country.iso === 'NG' ? '803 555 0142' : 'Your number'}
            placeholderTextColor={tokens.text3}
            accessibilityLabel="Phone number"
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={18}
            className="min-w-0 flex-1 font-ui-b text-[20px] tracking-[-0.2px] text-ink-1"
            style={INPUT_RESET}
          />
        </View>
      </View>

      <Sheet visible={picking} onClose={close}>
        <Text
          accessibilityRole="header"
          className="self-start pt-1 font-ui-b text-[20px] leading-7 tracking-[-0.2px] text-ink-1"
        >
          Where is your number from?
        </Text>
        <SearchField label="Search countries" value={search} onChange={setSearch} />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          className="w-full"
          // Tall enough to browse, short enough that the scrim above still
          // shows and can be tapped to close.
          style={{ maxHeight: 360 }}
        >
          <View accessibilityRole="radiogroup">
            {matches.map((item) => {
              const selected = item.iso === country.iso;
              return (
                <Pressable
                  key={item.iso}
                  onPress={() => {
                    onCountry(item);
                    close();
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, checked: selected }}
                  accessibilityLabel={`${item.name}, ${item.dial}`}
                  className="h-14 flex-row items-center gap-3"
                >
                  <Text className="w-7 text-[20px]">{flag(item.iso)}</Text>
                  <Text numberOfLines={1} className="flex-1 font-ui-sb text-[16px] leading-6 text-ink-1">
                    {item.name}
                  </Text>
                  <Text className="font-ui text-[14px] leading-5 text-ink-2">{item.dial}</Text>
                  {selected ? (
                    <View className="h-7 w-7 items-center justify-center rounded-full bg-pop-green">
                      <Icon name="check" size={16} color={POP.on} />
                    </View>
                  ) : (
                    <View className="h-7 w-7" />
                  )}
                </Pressable>
              );
            })}
          </View>
          {matches.length === 0 && (
            <Text className="py-4 font-ui text-[14px] leading-5 text-ink-2">
              No country matches “{search.trim()}”. You can also type your number starting with +
              and your country code.
            </Text>
          )}
        </ScrollView>
      </Sheet>
    </View>
  );
}
