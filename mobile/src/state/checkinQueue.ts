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
      const queue = await read();
      const remaining: QueuedScan[] = [];

      for (let i = 0; i < queue.length; i++) {
        const scan = queue[i];
        if (scan.event !== event) {
          remaining.push(scan);
          continue;
        }
        try {
          const result = await scanTicket(scan.event, scan.code, scan.method);
          counts = result.counts;
          // "Already checked in" is fine: the same ticket was scanned at
          // another door while this phone was offline.
          if (result.outcome !== 'checked_in' && result.outcome !== 'already_checked_in') bad++;
        } catch (error) {
          if (isOffline(error)) {
            // Still no signal. Keep this one and everything after it.
            remaining.push(...queue.slice(i));
            break;
          }
          // The server refused the request itself (the event ended, or this
          // person can no longer check in). Retrying would never succeed.
          bad++;
        }
      }

      await write(remaining);
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
      const queue = await read();
      const known = queue.some(
        (scan) => scan.event === event && scan.code.toLowerCase() === code.toLowerCase(),
      );
      if (!known) {
        queue.push({ event, code, method, at: new Date().toISOString() });
        await write(queue);
      }
      setWaiting(queue.filter((scan) => scan.event === event).length);
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
