/** Types for `schema.mjs`. */

type JsonLd = Record<string, unknown>;

export function organizationLd(): JsonLd;
export function websiteLd(): JsonLd;

export function webPageLd(input: {
  url: string;
  title: string;
  description?: string;
  image?: string;
  dateModified?: string;
  type?: string;
}): JsonLd;

export function breadcrumbLd(input: {
  url: string;
  trail: { name: string; path: string }[];
}): JsonLd;

export function articleLd(input: {
  url: string;
  title: string;
  description?: string;
  datePublished?: string;
  dateModified?: string;
  image?: string;
  author?: string;
}): JsonLd;

export function eventLd(event: Record<string, any>, url: string): JsonLd;

export function itemListLd(input: {
  url: string;
  name: string;
  itemType?: string;
  items: {
    url: string;
    name: string;
    datePublished?: string;
    startDate?: string;
    image?: string;
  }[];
}): JsonLd;

export function faqLd(input: {
  url: string;
  questions: { q: string; a: string }[];
}): JsonLd;
