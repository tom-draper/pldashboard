import { MediaQuery } from 'svelte/reactivity';

/** The viewport width (px) at or below which the dashboard uses its mobile layout. */
export const MOBILE_BREAKPOINT = 700;

/**
 * Reactive mobile-viewport flag. `.current` is `true` when the viewport is at
 * most {@link MOBILE_BREAKPOINT}px wide.
 *
 * Replaces the `bind:innerWidth={pageWidth}` + `pageWidth <= 700` pattern that
 * was repeated across the dashboard. During SSR (no `matchMedia`) it reports
 * `false`, i.e. desktop-first, matching the previous `undefined <= 700`
 * behaviour.
 */
export function mobileView() {
	return new MediaQuery(`max-width: ${MOBILE_BREAKPOINT}px`);
}
