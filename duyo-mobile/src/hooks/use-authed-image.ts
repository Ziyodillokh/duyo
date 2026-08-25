import { useEffect, useState } from 'react';

import { apiClient } from '@/api/client';

/**
 * Take the server's absolute media URL back down to a path.
 *
 * The server builds it from its own `public_base_url`, which in development is
 * not the host the app is talking to — the phone reaches the API over the LAN
 * while the backend still calls itself localhost. Going through apiClient's
 * baseURL keeps the token, the origin and the request on the host the app
 * actually reached, whatever the server thinks it is called.
 *
 * (The same reasoning, and the same three lines, as in
 * components/goals/note-bubble.tsx.)
 */
function toApiPath(url: string): string {
  const at = url.indexOf('/v1/');
  return at === -1 ? url : url.slice(at + 3);
}

/**
 * An image behind the bearer token, as something `<Image source>` can take.
 *
 * The child's photo is served by an AUTHENTICATED route on purpose — the
 * public media route sends `Cache-Control: public` and is reachable by
 * anyone holding the URL, which is right for a book cover and wrong for a
 * face. An authenticated URL cannot go straight into an `<Image>`: RN's
 * image loader sends no Authorization header, and on web an `<img>` cannot
 * be made to. So the bytes are fetched through the API client and handed
 * over as an object URL.
 *
 * Returns null while loading and null on failure. A profile that falls back
 * to the mascot is a correct screen; a broken-image icon is not.
 */
export function useAuthedImage(url: string | null | undefined): string | null {
  // The URL is kept ALONGSIDE the object URL rather than cleared by the
  // effect when it changes. Clearing it meant a synchronous setState in
  // the effect body, which the React Compiler rejects as a cascading
  // render; pairing them lets the stale case be derived instead — a
  // result for a different URL is simply not this URL’s result.
  const [loaded, setLoaded] = useState<{ url: string; local: string } | null>(
    null,
  );

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let created: string | null = null;

    void (async () => {
      try {
        const res = await apiClient.get<Blob>(toApiPath(url), {
          responseType: 'blob',
        });
        if (cancelled) return;
        created = URL.createObjectURL(res.data);
        setLoaded({ url, local: created });
      } catch {
        // Left as it was: the caller falls back to the mascot, which is
        // a correct screen. A broken-image icon is not.
      }
    })();

    // An object URL is a document-lifetime reference; without the revoke
    // every photo the child ever opened would sit in memory until reload.
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url]);

  return url && loaded?.url === url ? loaded.local : null;
}
