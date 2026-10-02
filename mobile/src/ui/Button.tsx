import { useState } from 'react';
import { Text } from 'react-native';

import { Press, Spinner } from './Press';
import { useTokens } from '../theme/ThemeProvider';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

/**
 * The pill button (Figma "Button").
 *
 * Primary is the one main action on a screen, secondary supports it, tertiary
 * is a low-emphasis text action. None of them is green: ink carries the
 * action so the colour-block cards stay the loudest thing on screen.
 *
 * Pressing changes the fill rather than the opacity. A dimmed pill this large
 * lets the surface show through and reads as disabled.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  className = '',
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** Leads the label. Hidden while loading. */
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const tokens = useTokens();
  const [pressed, setPressed] = useState(false);

  const surface = disabled
    ? variant === 'primary'
      ? 'bg-line'
      : variant === 'secondary'
        ? 'border-[1.5px] border-line-strong'
        : ''
    : variant === 'primary'
      ? pressed
        ? 'bg-ink-2'
        : 'bg-ink'
      : variant === 'secondary'
        ? `border-[1.5px] border-ink ${pressed ? 'bg-surf-sunken' : ''}`
        : pressed
          ? 'bg-surf-sunken'
          : '';

  const labelColor = disabled
    ? 'text-ink-3 opacity-70'
    : variant === 'primary'
      ? 'text-on-ink'
      : 'text-ink';

  return (
    <Press
      onPress={loading || disabled ? undefined : onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={loading || disabled}
      accessibilityLabel={label}
      accessibilityState={{ busy: loading }}
      className={`h-14 min-w-[140px] flex-row items-center justify-center gap-2 rounded-full px-6 ${surface} ${className}`}
    >
      {loading ? (
        // The spinner replaces the label at the button's own width, so the
        // layout around it never shifts.
        <Spinner size={20} color={variant === 'primary' ? tokens.onInk : tokens.ink} />
      ) : (
        <>
          {icon}
          <Text numberOfLines={1} className={`font-ui-sb text-[16px] leading-6 ${labelColor}`}>
            {label}
          </Text>
        </>
      )}
    </Press>
  );
}
