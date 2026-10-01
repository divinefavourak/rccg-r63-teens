import type { Option } from '../components/form';

/**
 * Choice lists mirrored from the Django models.
 *
 * These are `choices` on `TeenProfile` and `EventRegistration`, so the values
 * must match the backend exactly — a label mismatch is cosmetic, a value
 * mismatch is a 400. Kept together here so there is one place to reconcile
 * when the hierarchy changes.
 *
 * Source: `profiles/models.py` (province, gender) and the registration
 * serializer's guardian fields.
 */

/** `TeenProfile.province` choices, verbatim. */
export const PROVINCES: Option[] = [
  { value: 'lagos_province_9', label: 'Lagos Province 9' },
  { value: 'lagos_province_28', label: 'Lagos Province 28' },
  { value: 'lagos_province_69', label: 'Lagos Province 69' },
  { value: 'lagos_province_84', label: 'Lagos Province 84' },
  { value: 'lagos_province_86', label: 'Lagos Province 86' },
  { value: 'lagos_province_104', label: 'Lagos Province 104' },
  { value: 'regional_hq', label: 'Regional Headquarter' },
];

/** `TeenProfile.gender` choices, verbatim. */
export const GENDERS: Option[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'not_specified', label: 'Prefer not to say' },
];

/**
 * Guardian relationship.
 *
 * A free-text field on the model, so these are conveniences rather than a
 * constraint — but offering the common answers beats making a teen type
 * "Mother" on a phone keyboard.
 */
export const GUARDIAN_RELATIONSHIPS: Option[] = [
  { value: 'Mother', label: 'Mother' },
  { value: 'Father', label: 'Father' },
  { value: 'Guardian', label: 'Guardian' },
  { value: 'Grandparent', label: 'Grandparent' },
  { value: 'Aunt', label: 'Aunt' },
  { value: 'Uncle', label: 'Uncle' },
  { value: 'Sibling', label: 'Older sibling' },
  { value: 'Other', label: 'Someone else' },
];

/**
 * Age bands, from `docs/07-feature-specifications.md` and the web signup.
 *
 * Shown as guidance while a date of birth is entered, so a teen learns which
 * group they land in rather than being rejected after submitting.
 */
export function ageGroupFor(age: number): { label: string; eligible: boolean } {
  if (age < 6) return { label: 'Under 6 — not yet eligible to join', eligible: false };
  if (age <= 8) return { label: 'Children (6–8)', eligible: true };
  if (age <= 12) return { label: 'Pre-teen (9–12)', eligible: true };
  if (age <= 19) return { label: 'Teen (13–19)', eligible: true };
  return { label: 'Superteen (19+)', eligible: true };
}
