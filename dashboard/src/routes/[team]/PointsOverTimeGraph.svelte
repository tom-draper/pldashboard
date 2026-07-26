<script lang="ts">
	import type { PlotData, PlotTrace, PlotLayout } from '$lib/types';
	import { createPlotlyGraph } from '$lib/plotlyGraph.svelte';
	import { getMatchdays, getTeamID, getTeams } from '$lib/team';
	import type { TeamsData } from './dashboard.types';
	import type { Team } from '$lib/types';

	const { data, team, mobileView }: { data: TeamsData; team: Team; mobileView: boolean } = $props();

	function getLineConfig(team: Team, isMainTeam: boolean): PlotTrace['line'] {
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

	function getLine(data: TeamsData, team: Team, isMainTeam: boolean): PlotTrace {
		const matchdays = getMatchdays(data, team);
		const dates = getMatchdayDates(data, team, matchdays);
		const y = getCumulativePoints(data, team, matchdays);
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

	function defaultLayout(): PlotLayout {
		const layout: PlotLayout = {
			title: { text: '' },
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
		const layoutUpdate = {
			'yaxis.title': { text: 'Points' },
			'yaxis.visible': true,
			'margin.l': 60,
			'margin.t': 15
		};
		Plotly.update(plotDiv, {}, layoutUpdate);
	}

	function setMobileLayout() {
		const layoutUpdate = {
			'yaxis.title': null,
			'yaxis.visible': false,
			'margin.l': 20,
			'margin.t': 5
		};
		// @ts-expect-error Plotly's Layout type does not allow these dotted-path update keys
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

	let plotDiv: HTMLDivElement;
	let plotData: PlotData;

	function genPlot() {
		plotData = buildPlotData(data, team);
		Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config);
	}

	function refreshPlot() {
		const newPlotData = buildPlotData(data, team);
		for (let i = 0; i < 20; i++) {
			plotData.data[i] = newPlotData.data[i];
		}

		Plotly.redraw(plotDiv);
		if (mobileView) {
			setMobileLayout();
		}
	}

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
