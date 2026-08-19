/*
 * The running best guess, as a fetch schedule any mode can own: a debounce that collapses
 * tap flurries and a latest-wins guard so a slow answer can't overwrite a newer one's result.
 */

import { apiPreview } from '../engine.js';

// How long after an answer changes before the preview refetches. Multi-select
// rapid taps collapse into one call; a fresh answer resets the timer.
export const PREVIEW_DEBOUNCE_MS = 250;

/**
 * A debounced, latest-wins preview fetcher: `onResult` fires only for the newest request.
 * @returns {{ schedule: (answers, onResult) => void, cancel: () => void }}
 */
export function createPreviewFeed({
  api, retailer, brand, group = false,
}) {
  let timer = null;
  let seq = 0;

  return {
    schedule(answers, onResult) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const mine = (seq += 1);
        // Snapshot: the request is about the answers as they were when it left,
        // and the caller's object goes on mutating underneath it.
        const snapshot = { ...answers };
        apiPreview(api, snapshot, retailer, brand, group).then((matches) => {
          // A newer answer already superseded this request — drop the stale result.
          if (mine !== seq) return;
          onResult(matches);
        });
      }, PREVIEW_DEBOUNCE_MS);
    },
    /** Drop a pending refresh. Anything already in flight is left to its guard. */
    cancel() {
      clearTimeout(timer);
    },
  };
}
