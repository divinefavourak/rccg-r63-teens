import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { toE164, type SignUpDetails } from './auth';
import type { ChurchLevel, ChurchNode } from '../api/types';
import { DEFAULT_COUNTRY, type Country } from '../data/countries';

/**
 * The sign-up answers, held across the one-question-per-screen steps.
 *
 * Each step is its own route, so the answers cannot live in a screen's local
 * state — going back and forward would lose them. They live here, above the
 * auth stack, and are dropped when the teen leaves it.
 */
export interface SignUpForm {
  firstName: string;
  lastName: string;
  gender: string;
  email: string;
  /** The country the phone number belongs to. */
  country: Country;
  /** As typed, without the country code. */
  phone: string;
  day: string;
  month: string;
  year: string;
  /** The church path chosen so far, top-down. */
  church: Partial<Record<ChurchLevel, ChurchNode>>;
}

const EMPTY: SignUpForm = {
  firstName: '',
  lastName: '',
  gender: '',
  email: '',
  country: DEFAULT_COUNTRY,
  phone: '',
  day: '',
  month: '',
  year: '',
  church: {},
};

/** The levels the flow asks for, in order. Area exists but is never shown. */
export const CHURCH_STEPS: ChurchLevel[] = ['region', 'province', 'zone', 'parish'];

interface SignUpValue {
  form: SignUpForm;
  /**
   * Which question is showing, 1-based. Held here with the answers so that
   * coming back from the code screen lands on the last question, not the first.
   */
  step: number;
  /** +1 when the last move was forward, -1 when it was back: the slide direction. */
  direction: 1 | -1;
  goTo: (step: number) => void;
  set: <K extends keyof SignUpForm>(key: K, value: SignUpForm[K]) => void;
  /** Choose a node at `level`, forgetting anything picked beneath it. */
  chooseChurch: (level: ChurchLevel, node: ChurchNode | null) => void;
  reset: () => void;
}

const SignUpContext = createContext<SignUpValue | null>(null);

export function SignUpProvider({ children }: { children: React.ReactNode }) {
  const [form, setForm] = useState<SignUpForm>(EMPTY);
  const [position, setPosition] = useState<{ step: number; direction: 1 | -1 }>({
    step: 1,
    direction: 1,
  });

  const goTo = useCallback((next: number) => {
    setPosition((prev) => ({ step: next, direction: next >= prev.step ? 1 : -1 }));
  }, []);

  const set = useCallback(<K extends keyof SignUpForm>(key: K, value: SignUpForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const chooseChurch = useCallback((level: ChurchLevel, node: ChurchNode | null) => {
    setForm((prev) => {
      // A different province makes the old zone and parish meaningless.
      const church: SignUpForm['church'] = {};
      for (const step of CHURCH_STEPS) {
        if (step === level) break;
        if (prev.church[step]) church[step] = prev.church[step];
      }
      if (node) church[level] = node;
      return { ...prev, church };
    });
  }, []);

  const reset = useCallback(() => {
    setForm(EMPTY);
    setPosition({ step: 1, direction: 1 });
  }, []);

  const value = useMemo(
    () => ({ form, ...position, goTo, set, chooseChurch, reset }),
    [form, position, goTo, set, chooseChurch, reset],
  );
  return <SignUpContext.Provider value={value}>{children}</SignUpContext.Provider>;
}

export function useSignUp(): SignUpValue {
  const ctx = useContext(SignUpContext);
  if (!ctx) throw new Error('useSignUp must be used inside <SignUpProvider>');
  return ctx;
}

// ─── Derived values ────────────────────────────────────────────────────────

/** The date of birth as `YYYY-MM-DD`, or null until it is a real past date. */
export function birthDate(form: SignUpForm): string | null {
  const day = Number(form.day);
  const month = Number(form.month);
  const year = Number(form.year);
  if (form.year.length !== 4 || !day || !month) return null;

  const date = new Date(year, month - 1, day);
  // `new Date(2011, 1, 31)` silently rolls over to March, so check it round-trips.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  if (date > new Date() || year < 1900) return null;

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function ageFrom(iso: string): number {
  const dob = new Date(`${iso}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const months = today.getMonth() - dob.getMonth();
  if (months < 0 || (months === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age;
}

/** The deepest church node chosen, which is what the account is attached to. */
export function deepestChurch(form: SignUpForm): ChurchNode | undefined {
  for (let i = CHURCH_STEPS.length - 1; i >= 0; i--) {
    const node = form.church[CHURCH_STEPS[i]];
    if (node) return node;
  }
  return undefined;
}

/** The body for `POST /auth/signup/complete/`, minus the code. */
export function toDetails(form: SignUpForm): SignUpDetails {
  return {
    email: form.email.trim().toLowerCase(),
    phone: toE164(form.phone, form.country.dial),
    first_name: form.firstName.trim(),
    last_name: form.lastName.trim(),
    gender: form.gender || undefined,
    date_of_birth: birthDate(form) ?? undefined,
    church_node: deepestChurch(form)?.id,
  };
}
