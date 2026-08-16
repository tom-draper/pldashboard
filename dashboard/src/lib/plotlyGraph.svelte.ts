import { onDestroy, onMount, untrack } from 'svelte';
import Plotly, { loadPlotly } from '$lib/plotly';

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
	/** Render this chart before normal charts during the initial page load. */
	initialDrawPriority?: 'high' | 'normal';
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

interface QueuedInitialDraw {
	draw: () => Promise<void>;
	priority: 'high' | 'normal';
	cancelled: boolean;
}

const initialDrawQueue: QueuedInitialDraw[] = [];
let processingInitialDraws = false;

function queueInitialDraw(draw: () => Promise<void>, priority: 'high' | 'normal') {
	const queuedDraw: QueuedInitialDraw = { draw, priority, cancelled: false };
	initialDrawQueue.push(queuedDraw);

	if (!processingInitialDraws) {
		processingInitialDraws = true;
		queueMicrotask(() => void processInitialDraws());
	}

	return () => {
		queuedDraw.cancelled = true;
	};
}

async function processInitialDraws() {
	try {
		while (initialDrawQueue.length > 0) {
			initialDrawQueue.sort(
				(a, b) => Number(b.priority === 'high') - Number(a.priority === 'high')
			);
			const queuedDraw = initialDrawQueue.shift()!;
			if (!queuedDraw.cancelled) {
				await queuedDraw.draw();
			}
		}
	} finally {
		processingInitialDraws = false;
		if (initialDrawQueue.length > 0) {
			processingInitialDraws = true;
			queueMicrotask(() => void processInitialDraws());
		}
	}
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
	let cancelInitialDraw: (() => void) | undefined;

	onMount(() => {
		if (controller.getNode() === undefined) {
			return;
		}
		// Plotly is browser-only and loaded lazily; await it before drawing. draw
		// may itself be async (e.g. awaiting Plotly.newPlot). Only mark ready once
		// it has actually drawn, so refresh/layout effects don't run too early.
		cancelInitialDraw = queueInitialDraw(async () => {
			await loadPlotly();
			await controller.draw();
			ready = true;
		}, controller.initialDrawPriority ?? 'normal');
	});

	onDestroy(() => {
		cancelInitialDraw?.();
		const node = controller.getNode();
		// Plotly.purge is only present once loadPlotly() has resolved; a component
		// torn down before the chart drew has nothing to purge.
		if (node && Plotly.purge) {
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
