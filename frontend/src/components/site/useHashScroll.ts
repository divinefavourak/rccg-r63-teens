import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Scrolls to the element named in the URL's hash.
 *
 * React Router changes the URL for a link like "/#install" but does not scroll
 * to it, and the browser's own hash scrolling has already given up by the time
 * a lazily loaded page renders. This does the scroll once the page is mounted.
 *
 * It depends on `location.key` rather than the hash, so clicking the same link
 * twice scrolls back to the section the second time as well.
 */
export const useHashScroll = () => {
  const { hash, key } = useLocation();

  useEffect(() => {
    if (!hash) return;
    // One frame later, so it lands after ScrollToTop's jump to the top and
    // after the section exists in the document.
    const frame = requestAnimationFrame(() => {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
    });
    return () => cancelAnimationFrame(frame);
  }, [hash, key]);
};
