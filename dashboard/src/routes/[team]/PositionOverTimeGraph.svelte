<script lang="ts">
	import { onMount } from 'svelte';
	import { getTeamID, getTeams } from '$lib/team';
	import type { TeamsData } from './dashboard.types';
	import type { Team } from '$lib/types';

	function getLineConfig(team: Team, isMainTeam: boolean) {
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

	function getLine(data: TeamsData, team: Team, isMainTeam: boolean) {
		const matchdays = Object.keys(data.form[team][data._id]);
		const dates = getMatchdayDates(data, team, matchdays);
		const y = getPositions(data, team, matchdays);

		const lineConfig = getLineConfig(team, isMainTeam);

		const line = {
			x: matchdays,
			y: y,
			name: team,
			mode: 'lines',
			line: lineConfig,
			text: dates,
			hovertemplate: `<b>${team}</b><br>Matchday %{x}<br>%{text|%d %b %Y}<br>Position: <b>%{y}</b><extra></extra>`,
			showlegend: false
		};
		return line;
	}

	function lines(data: TeamsData, team: Team) {
		const lines = getTeams(data)
			.filter((_team) => _team !== team)
			.map((_team) => getLine(data, _team, false));

		// Add this team last to ensure it overlaps all other lines
		const line = getLine(data, team, true);
		lines.push(line);
		return lines;
	}

	function positionRangeShapes() {
		const matchdays = Object.keys(data.form[team][data._id]);
		return [
			{
				type: 'rect',
				x0: matchdays[0],
				y0: 4.5,
				x1: matchdays[matchdays.length - 1],
				y1: 0.5,
				line: {
					width: 0
				},
				fillcolor: '#00fe87',
				opacity: 0.2,
				layer: 'below'
			},
			{
				type: 'rect',
				x0: matchdays[0],
				y0: 6.5,
				x1: matchdays[matchdays.length - 1],
				y1: 4.5,
				line: {
					width: 0
				},
				fillcolor: '#02efff',
				opacity: 0.2,
				layer: 'below'
			},
			{
				type: 'rect',
				x0: matchdays[0],
				y0: 20.5,
				x1: matchdays[matchdays.length - 1],
				y1: 17.5,
				line: {
					width: 0
				},
				fillcolor: '#f83027',
				opacity: 0.2,
				layer: 'below'
			}
		];
	}

	function defaultLayout() {
		const yLabels = Array.from(Array(20), (_, i) => i + 1);
		return {
			title: false,
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
				ticktext: yLabels,
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
		//@ts-ignore
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
		//@ts-ignore
		Plotly.update(plotDiv, {}, layoutUpdate);
	}

	function buildPlotData(data: TeamsData, team: Team): PlotData {
		const plotData = {
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
	let setup = false;
	onMount(() => {
		genPlot();
		setup = true;
	});

	function genPlot() {
		plotData = buildPlotData(data, team);
		//@ts-ignore
		new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config).then((plot) => {
			// Once plot generated, add resizable attribute to it to shorten height for mobile view
			plot.children[0].children[0].classList.add('resizable-graph');
		});
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

		//@ts-ignore
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

<div id="plotly">
	<div id="plotDiv" bind:this={plotDiv}>
		<!-- Plotly chart will be drawn inside this DIV -->
	</div>
</div>
