<script lang="ts">
	import type { PlotData, PlotTrace, PlotLayout } from '$lib/types';
	import { onMount } from 'svelte';

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
		if (!setup) {
			return;
		}

		const layoutUpdate = {
			'yaxis.title': { text: 'Conceded' },
			'yaxis.visible': true,
			'margin.l': 60
		};
		Plotly.update(plotDiv, {}, layoutUpdate);
	}

	function setMobileLayout() {
		if (!setup) {
			return;
		}

		const layoutUpdate = {
			'yaxis.title': null,
			'yaxis.visible': false,
			'margin.l': 20
		};
		//@ts-expect-error
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
		//@ts-expect-error
		new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config);
	}

	function refreshPlot() {
		if (!setup) {
			return;
		}

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
	let setup = false;
	onMount(() => {
		genPlot();
		setup = true;
	});

	$: team && refreshPlot();
	$: !mobileView && setDefaultLayout();
	$: setup && mobileView && setMobileLayout();

	export let team: string,
		getConcededBars: () => PlotTrace[],
		getConcededTeamBars: () => PlotTrace,
		getXLabels: () => string[],
		getYAxisLayout: () => PlotLayout['yaxis'],
		mobileView: boolean;
</script>

<div id="plotly">
	<div id="plotDiv" class="resizable-graph" bind:this={plotDiv}>
		<!-- Plotly chart will be drawn inside this DIV -->
	</div>
</div>
