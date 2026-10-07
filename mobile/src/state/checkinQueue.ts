import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApiError } from '../api/client';
import { scanTicket } from '../api/queries';
import type { CheckInResult } from '../api/types';

/**
 * Scans made with no signal, kept until they can be sent.
 *
 * `docs/CONSOLE-FIGMA-PROMPT.md`: check-in is for "a volunteer at a door, on a
 * phone, on a bad connection", with "an offline banner with a queued-scans
 * count". A church hall on a Saturday morning is exactly where the network
 * gives out, and a queue of teens at the door cannot wait for it.
 *
 * Saved to the phone, not just held in memory, so a scan survives the app being
 * closed between the hall and the car park.
 */

const STORAGE_KEY = 'faithtribe.checkinQueue';

interface QueuedScan {
  event: string;
  code: string;
  method: 'qr_scan' | 'manual';
  /** When it was scanned, for the record. */
  at: string;
}

async function read(): Promise<QueuedScan[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueuedScan[]) : [];
  } catch {
    return [];
  }
}

async function write(queue: QueuedScan[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Storage is full or unavailable. The scan is still in memory for this
    // session, which is the best that can be done.
  }
}

/** A network failure, as opposed to the server answering with a refusal. */
export function isOffline(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

/**
 * A failure that says nothing about the ticket: no signal, a server that is
 * down or busy, or a session that needs signing in again. The scan is kept and
 * tried later. Only a plain "no" from the server (another 4xx) is final.
 */
function worthRetrying(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.isTransient || error.status === 401 || error.status === 429;
}

/**
 * One change to the saved queue at a time.
 *
 * Reading, changing and writing the queue is three steps with waits between
 * them. A scan saved while another change was mid-way was overwritten by that
 * change's older copy, and the teen was never checked in.
 */
let lastChange: Promise<unknown> = Promise.resolve();

function change(update: (queue: QueuedScan[]) => QueuedScan[]): Promise<QueuedScan[]> {
  const next = lastChange.then(async () => {
    const updated = update(await read());
    await write(updated);
    return updated;
  });
  lastChange = next.catch(() => undefined);
  return next;
}

const sameScan = (a: QueuedScan, b: QueuedScan) =>
  a.event === b.event && a.code.toLowerCase() === b.code.toLowerCase();

export interface CheckInQueue {
  /** Scans for this event still waiting to be sent. */
  waiting: number;
  /**
   * Saved scans that were sent and turned out not to be good tickets. The
   * volunteer waved these people through on trust, so they need telling.
   */
  refused: number;
  /** Save a scan that could not be sent. A repeat of the same code is ignored. */
  add: (code: string, method: 'qr_scan' | 'manual') => Promise<void>;
  /** Try to send everything waiting. Returns the latest counts, if any got through. */
  flush: () => Promise<CheckInResult['counts'] | null>;
  clearRefused: () => void;
}

/**
 * The queue for one event. Tries again every 20 seconds while anything is
 * waiting, and whenever `flush` is called (after any scan that got through).
 */
export function useCheckInQueue(
  event: string | undefined,
  onCounts: (counts: CheckInResult['counts']) => void,
): CheckInQueue {
  const [waiting, setWaiting] = useState(0);
  const [refused, setRefused] = useState(0);
  const flushing = useRef(false);
  const onCountsRef = useRef(onCounts);
  onCountsRef.current = onCounts;

  const recount = useCallback(async () => {
    const queue = await read();
    setWaiting(queue.filter((scan) => scan.event === event).length);
  }, [event]);

  const flush = useCallback(async (): Promise<CheckInResult['counts'] | null> => {
    if (!event || flushing.current) return null;
    flushing.current = true;
    let counts: CheckInResult['counts'] | null = null;
    let bad = 0;

    try {
      const mine = (await read()).filter((scan) => scan.event === event);
      const settled: QueuedScan[] = [];

      for (const scan of mine) {
        try {
          const result = await scanTicket(scan.event, scan.code, scan.method);
          counts = result.counts;
          // "Already checked in" is fine: the same ticket was scanned at
          // another door while this phone was offline.
          if (result.outcome !== 'checked_in' && result.outcome !== 'already_checked_in') bad++;
        } catch (error) {
          // Keep this one and everything after it for the next try.
          if (worthRetrying(error)) break;
          // The server refused the request itself (the event ended, or this
          // person can no longer check in). Retrying would never succeed.
          bad++;
        }
        settled.push(scan);
      }

      // Take out only what was dealt with, from the queue as it is now: a scan
      // saved while these were being sent is still in it.
      const remaining = await change((queue) =>
        queue.filter((scan) => !settled.some((done) => sameScan(done, scan))),
      );
      setWaiting(remaining.filter((scan) => scan.event === event).length);
      if (bad) setRefused((n) => n + bad);
      if (counts) onCountsRef.current(counts);
    } finally {
      flushing.current = false;
    }
    return counts;
  }, [event]);

  const add = useCallback(
    async (code: string, method: 'qr_scan' | 'manual') => {
      if (!event) return;
      const scan: QueuedScan = { event, code, method, at: new Date().toISOString() };
      const queue = await change((saved) =>
        saved.some((known) => sameScan(known, scan)) ? saved : [...saved, scan],
      );
      setWaiting(queue.filter((saved) => saved.event === event).length);
    },
    [event],
  );

  // Pick up anything left from an earlier session, and try it straight away.
  useEffect(() => {
    recount().then(() => flush());
  }, [recount, flush]);

  useEffect(() => {
    if (waiting === 0) return;
    const timer = setInterval(flush, 20_000);
    return () => clearInterval(timer);
  }, [waiting, flush]);

  const clearRefused = useCallback(() => setRefused(0), []);

  return { waiting, refused, add, flush, clearRefused };
}
