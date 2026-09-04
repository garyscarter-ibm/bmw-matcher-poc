/*
 * The running best guess, as a fetch schedule any mode can own.
 *
 * Lifted out of modes/questionnaire.js when a second mode (podium) wanted the
 * same behaviour behind a different surface. Only the SCHEDULING moved: the
 * debounce that collapses a flurry of taps into one request, and the latest-wins
 * guard that drops a slow answer's result once a newer one has been asked for.
 * Both are about the network rather than about the strip, which is why they are
 * the half that is shareable — how the matches are painted, and where, stays
 * with whichever mode is painting them.
 *
 * The guard is the part that is easy to get wrong twice. Without the debounce a
 * multi-select fires a request per tap; without the sequence check the answers
 * on screen and the cars under them can disagree, because responses are free to
 * arrive in a different order from the questions that caused them.
 *
 * Each mode makes its own feed, so its debounce and its in-flight requests are
 * its own: two feeds cannot cancel each other's work.
 */

import { apiPreview } from '../engine.js';

// How long after an answer changes before the preview refetches. Multi-select
// rapid taps collapse into one call; a fresh answer resets the timer.
export const PREVIEW_DEBOUNCE_MS = 250;

/**
 * A debounced, latest-wins preview fetcher for one retailer's stock.
 *
 * `group` is passed straight through to the engine: a strip of individual cars
 * wants every listing, a podium wants them grouped by model, and that is a
 * property of the mode rather than of any one request.
 *
 * `onResult` is per-schedule, not per-feed, so the caller can hand each refresh
 * whatever it needs to paint. It is called only for a result that is still the
 * newest one asked for. A superseded response is dropped silently: the newer
 * request is already on its way, and reporting a result the answers have moved
 * past is the bug this exists to prevent.
 *
 * apiPreview never throws (a failed guess resolves to []), so there is no error
 * path here on purpose — a preview that cannot load is a strip that does not
 * update, never a broken question.
 *
 * @returns {{ schedule: (answers, onResult) => void, cancel: () => void }}
 */
export function createPreviewFeed({
  api, retailer, brand, scope, group = false,
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
        apiPreview(api, snapshot, retailer, brand, scope, group).then((matches) => {
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
