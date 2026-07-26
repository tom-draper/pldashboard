import { onDestroy, onMount, untrack } from 'svelte';

/**
 * The per-graph hooks the {@link createPlotlyGraph} lifecycle drives. Each graph
 * keeps its own figure building and layout logic; this only orchestrates *when*
 * those run.
 */
export interface PlotlyGraphController {
	/** The chart's container element (via `bind:this`). Read after mount. */
	getNode: () => HTMLElement | undefined;
	/** Draw the initial plot: build the figure and call `Plotly.newPlot`. May be async. */
	draw: () => void | Promise<void>;
	/** Re-render after {@link trigger} changes: rebuild data and `Plotly.redraw`. */
	refresh: () => void;
	/** Apply the desktop layout; run when the viewport is not mobile. */
	applyDefaultLayout?: () => void;
	/** Apply the mobile layout; run once drawn and the viewport is mobile. */
	applyMobileLayout?: () => void;
	/** Reactive getter: is the viewport mobile? Omit for graphs with no mobile layout. */
	isMobile?: () => boolean;
	/** Reactive getter whose change triggers a {@link refresh} (e.g. the selected team). */
	trigger: () => unknown;
}

/**
 * Drives a Plotly chart's Svelte lifecycle: draw on mount, purge on destroy, and
 * redraw / re-layout in response to reactive changes. Extracted from the dozen
 * graph components that all repeated this exact orchestration.
 *
 * Call it once at the top level of a component's `<script>`. Each effect mirrors
 * the pre-runes `$:` statements exactly: `untrack` keeps its dependency set to
 * just the guard (`trigger` / `isMobile`), and readiness is checked *inside*
 * `untrack` so — like the old `if (!setup) return` guards — it gates the work
 * without becoming a dependency of the first two effects.
 */
export function createPlotlyGraph(controller: PlotlyGraphController): void {
	let ready = $state(false);

	onMount(() => {
		if (controller.getNode() === undefined) {
			return;
		}
		// draw may be async (e.g. awaiting Plotly.newPlot); only mark ready once
		// it has actually drawn, so refresh/layout effects don't run too early.
		const drawn = controller.draw();
		if (drawn instanceof Promise) {
			drawn.then(() => {
				ready = true;
			});
		} else {
			ready = true;
		}
	});

	onDestroy(() => {
		const node = controller.getNode();
		if (node) {
			Plotly.purge(node);
		}
	});

	$effect(() => {
		if (controller.trigger()) {
			untrack(() => {
				if (ready) controller.refresh();
			});
		}
	});

	if (controller.isMobile && controller.applyDefaultLayout) {
		$effect(() => {
			if (!controller.isMobile!()) {
				untrack(() => {
					if (ready) controller.applyDefaultLayout!();
				});
			}
		});
	}

	if (controller.isMobile && controller.applyMobileLayout) {
		$effect(() => {
			if (ready && controller.isMobile!()) {
				untrack(() => controller.applyMobileLayout!());
			}
		});
	}
}
