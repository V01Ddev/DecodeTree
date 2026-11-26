/**
 * GoatCounter's count.js attaches `window.goatcounter` at runtime (see the
 * snippet in index.html). Only the surface this app uses is described.
 * https://www.goatcounter.com/help/js
 *
 * No imports or exports on purpose: that keeps this a global script, so the
 * `Window` interface below merges with the built-in one.
 */

interface GoatCounterVars {
  /** Mark this hit as an event rather than a page view. */
  event?: boolean
  path?: string
  title?: string
}

interface GoatCounter {
  /** Undefined until count.js has loaded, so callers must optional-chain. */
  count?: (vars?: GoatCounterVars) => void
}

interface Window {
  goatcounter?: GoatCounter
}
