<script lang="ts">
	import type { PlotData, PlotTrace, PlotLayout, PlotShape } from '$lib/types';
	import { onMount, onDestroy } from 'svelte';
	import { getMatchdays, getTeamID, getTeams } from '$lib/team';
	import type { TeamsData } from './dashboard.types';
	import type { Team } from '$lib/types';

	function getLineConfig(team: Team, isMainTeam: boolean): PlotTrace['line'] {
		let lineConfig;
		if (isMainTeam) {
			// Get team primary color from css variable
			const teamKey = getTeamID(team);
			const lineColor = getComputedStyle(document.documentElement).getPropertyValue(`--${teamKey}`);
			lineConfig = { color: lineColor, width: 4 };
		} else {
			lineConfig = { color: '#d3d3d3' };
		}
		return lineConfig;
	}

	function getPositions(data: TeamsData, team: Team, matchdays: string[]): number[] {
		return matchdays.map((matchday) => data.form[team][data._id][matchday].position);
	}

	function getMatchdayDates(data: TeamsData, team: Team, matchdays: string[]) {
		return matchdays.map((matchday) => data.form[team][data._id][matchday].date);
	}

	function getLine(data: TeamsData, team: Team, isMainTeam: boolean): PlotTrace {
		const matchdays = getMatchdays(data, team);
		const dates = getMatchdayDates(data, team, matchdays);
		const y = getPositions(data, team, matchdays);

		const lineConfig = getLineConfig(team, isMainTeam);

		const line: PlotTrace = {
			x: matchdays,
			y: y,
			name: team,
			mode: 'lines',
			line: lineConfig,
			text: dates as unknown as string[],
			hovertemplate: `<b>${team}</b><br>Matchday %{x}<br>%{text|%d %b %Y}<br>Position: <b>%{y}</b><extra></extra>`,
			showlegend: false
		};
		return line;
	}

	function lines(data: TeamsData, team: Team): PlotTrace[] {
		const lines = getTeams(data)
			.filter((_team) => _team !== team)
			.map((_team) => getLine(data, _team, false));

		// Add this team last to ensure it overlaps all other lines
		const line = getLine(data, team, true);
		lines.push(line);
		return lines;
	}

	function positionRangeShapes(): PlotShape[] {
		const matchdays = getMatchdays(data, team);

		// A background band spanning the given league positions. y is inverted
		// (1 at the top), so a slot n sits between n-0.5 and n+0.5.
		const band = (topSlot: number, bottomSlot: number, fillcolor: string): PlotShape => ({
			type: 'rect',
			x0: matchdays[0],
			x1: matchdays[matchdays.length - 1],
			y0: topSlot - 0.5,
			y1: bottomSlot + 0.5,
			line: { width: 0 },
			fillcolor,
			opacity: 0.2,
			layer: 'below'
		});

		return [
			band(1, 5, '#00fe87'), // Champions League: 1–5 (green, --win)
			band(6, 7, '#02efff'), // Europa League: 6–7 (cyan)
			band(8, 8, '#c600d8'), // Conference League: 8 (pink, --pink)
			band(18, 20, '#f83027') // Relegation: 18–20 (red, --lose)
		];
	}

	function defaultLayout(): PlotLayout {
		const yLabels = Array.from(Array(20), (_, i) => i + 1);
		return {
			title: { text: '' },
			autosize: true,
			margin: { r: 20, l: 60, t: 15, b: 40, pad: 5 },
			hovermode: 'closest',
			plot_bgcolor: '#fafafa',
			paper_bgcolor: '#fafafa',
			yaxis: {
				title: { text: 'Position' },
				gridcolor: 'gray',
				showgrid: false,
				showline: false,
				zeroline: false,
				autorange: 'reversed',
				fixedrange: true,
				ticktext: yLabels.map(String),
				tickvals: yLabels,
				visible: true
			},
			xaxis: {
				title: { text: 'Matchday' },
				linecolor: 'black',
				showgrid: false,
				showline: false,
				fixedrange: true
			},
			shapes: positionRangeShapes(),
			dragmode: false
		};
	}

	function setDefaultLayout() {
		if (!setup) {
			return;
		}

		const layoutUpdate = {
			'yaxis.title': { text: 'Position' },
			'yaxis.visible': true,
			'yaxis.tickvals': Array.from(Array(20), (_, i) => i + 1),
			'margin.l': 60,
			'margin.t': 15
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
			'yaxis.tickvals': Array.from(Array(10), (_, i) => i + 2),
			'margin.l': 20,
			'margin.t': 5
		};
		//@ts-expect-error
		Plotly.update(plotDiv, {}, layoutUpdate);
	}

	function buildPlotData(data: TeamsData, team: Team): PlotData {
		const plotData: PlotData = {
			data: lines(data, team),
			layout: defaultLayout(),
			config: {
				responsive: true,
				showSendToCloud: false,
				displayModeBar: false
			}
		};
		return plotData;
	}

	let plotDiv: HTMLDivElement, plotData: PlotData;

	onDestroy(() => {
		// Remove Plotly's resize listeners and DOM when the graph is destroyed.
		if (plotDiv) {
			Plotly.purge(plotDiv);
		}
	});
	let setup = false;
	onMount(() => {
		genPlot();
		setup = true;
	});

	function genPlot() {
		plotData = buildPlotData(data, team);
		//@ts-expect-error
		new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config);
	}

	function refreshPlot() {
		if (!setup) {
			return;
		}
		const newPlotData = buildPlotData(data, team);
		for (let i = 0; i < 20; i++) {
			plotData.data[i] = newPlotData.data[i];
		}

		plotData.layout.shapes = positionRangeShapes();

		Plotly.redraw(plotDiv);
		if (mobileView) {
			setMobileLayout();
		}
	}

	$: team && refreshPlot();
	$: !mobileView && setDefaultLayout();
	$: setup && mobileView && setMobileLayout();

	export let data: TeamsData, team: Team, mobileView: boolean;
</script>

<div>
	<div class="resizable-graph" bind:this={plotDiv}>
		<!-- Plotly chart will be drawn inside this DIV -->
	</div>
</div>
