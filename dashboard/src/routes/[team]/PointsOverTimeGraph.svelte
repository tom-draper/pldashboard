<script lang="ts">
	import { onMount } from 'svelte';
	import { getMatchdays, getTeamID, getTeams } from '$lib/team';
	import type { TeamsData } from './dashboard.types';
	import type { Team } from '$lib/types';

	function getLineConfig(team: Team, isMainTeam: boolean) {
		let lineConfig: { color: string; width?: number };
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

	function getCumulativePoints(data: TeamsData, team: Team, matchdays: string[]) {
		const y = matchdays.map((matchday) => data.form[team][data._id][matchday].cumPoints);
		return y;
	}

	function getMatchdayDates(data: TeamsData, team: Team, matchdays: string[]) {
		const dates = matchdays.map((matchday) => data.form[team][data._id][matchday].date);
		return dates;
	}

	function getLine(data: TeamsData, team: Team, isMainTeam: boolean) {
		const matchdays = getMatchdays(data, team);
		const dates = getMatchdayDates(data, team, matchdays);
		const y = getCumulativePoints(data, team, matchdays);
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
		const lines = [];
		const teams = getTeams(data);
		for (const _team of teams) {
			if (_team === team) {
				continue;
			}
			const line = getLine(data, _team, false);
			lines.push(line);
		}

		// Add this team last to ensure it overlaps all other lines
		const line = getLine(data, team, true);
		lines.push(line);
		return lines;
	}

	function defaultLayout() {
		const layout: Plotly.Layout = {
			// @ts-ignore
			title: false,
			autosize: true,
			margin: { r: 20, l: 60, t: 0, b: 40, pad: 5 },
			hovermode: 'closest',
			plot_bgcolor: '#fafafa',
			paper_bgcolor: '#fafafa',
			yaxis: {
				title: { text: 'Points' },
				gridcolor: 'gray',
				showgrid: false,
				showline: false,
				zeroline: false,
				fixedrange: true,
				visible: true
			},
			xaxis: {
				title: { text: 'Matchday' },
				linecolor: 'black',
				showgrid: false,
				showline: false,
				fixedrange: true
			},
			dragmode: false
		};
		return layout;
	}

	function setDefaultLayout() {
		if (!setup) {
			return;
		}

		const layoutUpdate = {
			'yaxis.title': { text: 'Points' },
			'yaxis.visible': true,
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
			'margin.l': 20,
			'margin.t': 5
		};
		//@ts-ignore
		Plotly.update(plotDiv, {}, layoutUpdate);
	}

	function buildPlotData(data: TeamsData, team: Team) {
		const plotData: Plotly.PlotlyDataLayoutConfig = {
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

	let plotDiv: HTMLDivElement, plotData: Plotly.PlotlyDataLayoutConfig;
	let setup = false;
	onMount(() => {
		genPlot();
		setup = true;
	});

	function genPlot() {
		plotData = buildPlotData(data, team);
		// @ts-ignore
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
