/** Types for `content/faq.mjs`. */

export type FaqQuestion = {
  q: string;
  /** Plain text, so search can match it and a crawler can read it. */
  a: string;
  link?: { label: string; to: string };
};

export type FaqTopic = {
  title: string;
  /** A pop colour class for the topic heading. */
  tone: string;
  questions: FaqQuestion[];
};

export const FAQ_TOPICS: FaqTopic[];
export const FAQ_QUESTIONS: FaqQuestion[];
