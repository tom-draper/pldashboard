import Plotly from '$lib/plotly';

/**
 * Apply Plotly's dotted-path layout updates without leaking its overly narrow
 * TypeScript definition into every chart component.
 */
export function updatePlotlyLayout(
	node: HTMLElement | undefined,
	update: Record<string, unknown>
): void {
	if (node) {
		Plotly.update(node, {}, update as Parameters<typeof Plotly.update>[2]);
	}
}

/** Update data and layout together, optionally disabling Plotly animation. */
export function updatePlotlyFigure(
	node: HTMLElement | undefined,
	data: Record<string, unknown>,
	layout: Record<string, unknown>,
	duration?: number
): void {
	if (node) {
		Plotly.update(
			node,
			data as Parameters<typeof Plotly.update>[1],
			layout as Parameters<typeof Plotly.update>[2],
			duration
		);
	}
}

/** Apply a layout-only relayout, including Plotly's dotted attribute paths. */
export function relayoutPlotly(
	node: HTMLElement | undefined,
	update: Record<string, unknown>
): void {
	if (node) {
		Plotly.relayout(node, update as Parameters<typeof Plotly.relayout>[1]);
	}
}
