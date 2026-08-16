<script lang="ts">
	import type { PlotData, PlotTrace, PlotLayout } from '$lib/types';
	import { createPlotlyGraph } from '$lib/plotlyGraph.svelte';
	import Plotly from '$lib/plotly';
	import { relayoutPlotly, updatePlotlyLayout } from '$lib/plotlyLayout';

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
		updatePlotlyLayout(plotDiv, layoutUpdate);
	}

	function setMobileLayout() {
		const layoutUpdate = {
			'yaxis.title': null,
			'yaxis.visible': false,
			'margin.l': 20
		};
		updatePlotlyLayout(plotDiv, layoutUpdate);
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
		relayoutPlotly(plotDiv, {
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
