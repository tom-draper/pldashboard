<script lang="ts">
	import { createPlotlyGraph } from '$lib/plotlyGraph.svelte';
	import Plotly from '$lib/plotly';
	import { getTeamID, getTeams } from '$lib/team';
	import type { TeamsData } from './dashboard.types';
	import type { Team, PlotLayout, PlotData, PlotTrace } from '$lib/types';

	const {
		data,
		team,
		playedDates,
		mobileView
	}: { data: TeamsData; team: Team; playedDates: Date[]; mobileView: boolean } = $props();

	function getFormLine(data: TeamsData, team: Team, isMainTeam: boolean) {
		const playedDates: Date[] = [];
		const matchdays: string[] = [];
		for (const matchday in data.form[team][data._id]) {
			if (data.form[team][data._id][matchday].score == null) {
				continue;
			}
			matchdays.push(matchday);
			const date = data.form[team][data._id][matchday].date ?? '';
			playedDates.push(new Date(date));
		}

		const y = matchdays.map((matchday) => {
			const form = data.form[team][data._id][matchday].formRating5 ?? 0;
			return form * 100;
		});

		const line: PlotTrace = {
			x: matchdays,
			y: y,
			name: team,
			mode: 'lines',
			line: getLineValue(isMainTeam),
			text: playedDates as unknown as string[],
			hovertemplate: `<b>${team}</b><br>Matchday %{x}<br>%{text|%d %b %Y}<br>Form: <b>%{y:.1f}%</b><extra></extra>`,
			showlegend: false
		};
		return line;
	}

	function getLineValue(isMainTeam: boolean) {
		let line: { color: string; width?: number };
		if (isMainTeam) {
			// Get team primary color from css variable
			const teamKey = getTeamID(team);
			const lineColor = getComputedStyle(document.documentElement).getPropertyValue(`--${teamKey}`);
			line = { color: lineColor, width: 4 };
		} else {
			line = { color: '#d3d3d3' };
		}
		return line;
	}

	function getLines(data: TeamsData, team: Team) {
		const teams = getTeams(data);
		const lines = teams.filter((t) => t !== team).map((t) => getFormLine(data, t, false));

		// Add this team last to ensure it overlaps all other lines
		const line = getFormLine(data, team, true);
		lines.push(line);
		return lines;
	}

	function defaultLayout() {
		const yLabels = Array.from(Array(11), (_, i) => i * 10);
		const layout: PlotLayout = {
			title: { text: '' },
			autosize: true,
			margin: { r: 20, l: 60, t: 15, b: 40, pad: 5 },
			hovermode: 'closest',
			plot_bgcolor: '#fafafa',
			paper_bgcolor: '#fafafa',
			yaxis: {
				title: { text: 'Form rating' },
				gridcolor: 'gray',
				showgrid: false,
				showline: false,
				zeroline: false,
				fixedrange: true,
				// @ts-expect-error Plotly's axis types do not allow ticktext alongside these options
				ticktext: yLabels,
				tickvals: yLabels,
				range: [-1, 101]
			},
			xaxis: {
				title: { text: 'Matchday' },
				linecolor: 'black',
				showgrid: false,
				showline: false,
				fixedrange: true,
				range: [playedDates[0], playedDates[playedDates.length - 1]]
			},
			dragmode: false
		};
		return layout;
	}

	function setDefaultLayout() {
		const layoutUpdate = {
			'yaxis.title': { text: 'Form rating' },
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

	function buildPlotData(data: TeamsData, team: Team) {
		const plotData: PlotData = {
			data: getLines(data, team),
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

	function genPlot() {
		plotData = buildPlotData(data, team);
		Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config);
	}

	function refreshPlot() {
		const newPlotData = buildPlotData(data, team);
		for (let i = 0; i < 20; i++) {
			plotData.data[i] = newPlotData.data[i];
		}

		if (plotData.layout && plotData.layout.xaxis && plotData.layout.xaxis.range) {
			plotData.layout.xaxis.range[0] = playedDates[0];
			plotData.layout.xaxis.range[1] = playedDates[playedDates.length - 1];
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
