import axios from 'axios';
import { LEGACY_API_URL, attachAuth } from '../api/axios';

/**
 * Client for the un-versioned `/api/` endpoints.
 *
 * This exists because `backend/urls.py` mounts `tickets.urls` at `api/` and
 * never under `api/v1/` — so `/tickets/...`, and the legacy payment and user
 * routes alongside them, resolve only without the version segment.
 *
 * What changed: it used to be a second, independently-written axios instance
 * with its own request interceptor, its own hardcoded fallback host, and **no**
 * 401 refresh handling at all — so a ticket call made with an expired access
 * token simply failed while the same user's other calls silently recovered. It
 * now shares one implementation of the auth behaviour with the versioned
 * client, and differs from it in exactly one thing: the base URL.
 */
export const api = axios.create({
  baseURL: LEGACY_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

attachAuth(api);

export default api;
