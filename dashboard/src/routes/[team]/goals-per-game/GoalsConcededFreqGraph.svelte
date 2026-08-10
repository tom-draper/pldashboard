<script lang="ts">
	import type { PlotData, PlotTrace, PlotLayout } from '$lib/types';
	import { createPlotlyGraph } from '$lib/plotlyGraph.svelte';
	import Plotly from '$lib/plotly';

	function defaultLayout(): PlotLayout {
		const xLabels = getXLabels();
		return {
			title: { text: '' },
			autosize: true,
			margin: { r: 20, l: 60, t: 15, b: 40, pad: 5 },
			hovermode: 'closest',
			barmode: 'overlay',
			bargap: 0,
			plot_bgcolor: '#fafafa',
			paper_bgcolor: '#fafafa',
			yaxis: getYAxisLayout(),
			xaxis: {
				title: { text: 'Conceded' },
				linecolor: 'black',
				showgrid: false,
				showline: false,
				fixedrange: true,
				ticktext: xLabels,
				tickvals: xLabels
			},
			legend: {
				x: 1,
				xanchor: 'right',
				y: 0.95
			},
			dragmode: false
		};
	}

	function setDefaultLayout() {
		const layoutUpdate = {
			'yaxis.title': { text: 'Conceded' },
			'yaxis.visible': true,
			'margin.l': 60
		};
		Plotly.update(plotDiv, {}, layoutUpdate);
	}

	function setMobileLayout() {
		const layoutUpdate = {
			'yaxis.title': null,
			'yaxis.visible': false,
			'margin.l': 20
		};
		// @ts-expect-error Plotly's Layout type does not allow these dotted-path update keys
		Plotly.update(plotDiv, {}, layoutUpdate);
	}

	function buildPlotData(): PlotData {
		const plotData = {
			data: getConcededBars(),
			layout: defaultLayout(),
			config: {
				responsive: true,
				showSendToCloud: false,
				displayModeBar: false
			}
		};
		return plotData;
	}

	function genPlot() {
		plotData = buildPlotData();
		Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config);
	}

	function refreshPlot() {
		plotData.data[1] = getConcededTeamBars();
		Plotly.relayout(plotDiv, {
			yaxis: getYAxisLayout()
		});
		Plotly.redraw(plotDiv);
		if (mobileView) {
			setMobileLayout();
		}
	}

	let plotDiv: HTMLDivElement, plotData: PlotData;

	const {
		team,
		getConcededBars,
		getConcededTeamBars,
		getXLabels,
		getYAxisLayout,
		mobileView
	}: {
		team: string;
		getConcededBars: () => PlotTrace[];
		getConcededTeamBars: () => PlotTrace;
		getXLabels: () => string[];
		getYAxisLayout: () => PlotLayout['yaxis'];
		mobileView: boolean;
	} = $props();

	createPlotlyGraph({
		getNode: () => plotDiv,
		draw: genPlot,
		refresh: refreshPlot,
		applyDefaultLayout: setDefaultLayout,
		applyMobileLayout: setMobileLayout,
		isMobile: () => mobileView,
		trigger: () => team
	});
</script>

<div>
	<div class="resizable-graph" bind:this={plotDiv}>
		<!-- Plotly chart will be drawn inside this DIV -->
	</div>
</div>
