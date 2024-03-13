<script lang="ts">
	import { onMount } from 'svelte';
	import { playedMatchdays } from '../team';
	import type { TeamsData, Team } from '../dashboard.types';

	function getTeamCleanSheets(data: TeamsData, team: Team): number[] {
		return Object.keys(data.form[team][data._id]).map((matchday) => {
			const score = data.form[team][data._id][matchday].score;
			if (score == null) {
				return 0;
			}
			const cleanSheetFlag = data.form[team][data._id][matchday].atHome
				? score.awayGoals > 0
					? 0
					: 1
				: score.awayGoals > 0
					? 1
					: 0;
			return cleanSheetFlag;
		});
	}

	function bars(data: TeamsData, team: Team, playedDates: Date[], matchdays: string[]) {
		const cleanSheets = getTeamCleanSheets(data, team);
		// Create inverse of clean sheets for goals scored
		const notCleanSheets = Array.from(cleanSheets).map((x) => (x == 0 ? 1 : 0));
		return [
			{
				name: 'Clean sheets',
				type: 'bar',
				x: playedDates,
				y: cleanSheets,
				text: matchdays,
				marker: { color: '#00fe87' },
				hovertemplate: '<b>Clean sheet<extra></extra>',
				showlegend: false
			},
			{
				name: 'Conceded',
				type: 'bar',
				x: playedDates,
				y: notCleanSheets,
				text: matchdays,
				marker: { color: '#f83027' },
				hovertemplate: '<b>Goals conceded<extra></extra>',
				showlegend: false
			}
		];
	}

	function baseLine() {
		return {
			type: 'line',
			x0: playedDates[0],
			y0: 0.5,
			x1: playedDates[playedDates.length - 1],
			y1: 0.5,
			layer: 'below',
			line: {
				color: '#d3d3d3',
				width: 2
			}
		};
	}

	function defaultLayout(matchdays: string[]) {
		return {
			title: false,
			autosize: true,
			height: 60,
			margin: { r: 20, l: 60, t: 0, b: 40, pad: 5 },
			barmode: 'stack',
			hovermode: 'closest',
			plot_bgcolor: '#fafafa',
			paper_bgcolor: '#fafafa',
			yaxis: {
				showticklabels: false,
				gridcolor: 'gray',
				showgrid: false,
				showline: false,
				zeroline: false,
				fixedrange: true
			},
			xaxis: {
				title: { text: 'Matchday' },
				linecolor: 'black',
				showgrid: false,
				showline: false,
				fixedrange: true,
				tickmode: 'array',
				tickvals: playedDates,
				ticktext: matchdays
			},
			shapes: [baseLine()],
			dragmode: false,
			showlegend: false
		};
	}

	function setDefaultLayout() {
		if (!setup) {
			return;
		}

		const layoutUpdate = {
			'margin.l': 60
		};
		//@ts-ignore
		Plotly.update(plotDiv, {}, layoutUpdate);
	}

	function setMobileLayout() {
		if (!setup) {
			return;
		}

		const layoutUpdate = {
			'margin.l': 20
		};
		//@ts-ignore
		Plotly.update(plotDiv, {}, layoutUpdate);
	}

	function hiddenLine(x: Date[]) {
		return {
			name: 'Avg',
			type: 'line',
			x: x,
			y: Array(x.length).fill(1.1),
			line: { color: '#FAFAFA', width: 1 },
			marker: {
				size: 1
			},
			hoverinfo: 'skip'
		};
	}

	function buildPlotData(data: TeamsData, team: Team): PlotData {
		const matchdays = playedMatchdays(data, team);
		const [cleanSheetsBar, concededBar] = bars(data, team, playedDates, matchdays);
		// Hidden line required on plot to make x-axis length match goalsScoredAndConcededGraph
		// Line added to plotly bar chart changes x-axis physical length vs without
		// TODO: Solution avoiding this hidden line
		const line = hiddenLine(cleanSheetsBar.x);
		const plotData = {
			data: [cleanSheetsBar, concededBar, line],
			layout: defaultLayout(matchdays),
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
		new Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config);
	}

	function refreshPlot() {
		if (!setup) {
			return;
		}

		const matchdays = playedMatchdays(data, team);
		const [cleanSheetsBar, concededBar] = bars(data, team, playedDates, matchdays);
		const line = hiddenLine(cleanSheetsBar.x);

		plotData.data[0] = cleanSheetsBar;
		plotData.data[1] = concededBar;
		plotData.data[2] = line;
		for (let i = 0; i < matchdays.length; i++) {
			plotData.layout.xaxis.ticktext[i] = matchdays[i];
		}
		plotData.layout.shapes[0] = baseLine();

		//@ts-ignore
		Plotly.redraw(plotDiv);
		if (mobileView) {
			setMobileLayout();
		}
	}

	$: team && refreshPlot();
	$: !mobileView && setDefaultLayout();
	$: setup && mobileView && setMobileLayout();

	export let data: TeamsData, team: Team, playedDates: Date[], mobileView: boolean;
</script>

<div id="plotly">
	<div id="plotDiv" bind:this={plotDiv}>
		<!-- Plotly chart will be drawn inside this DIV -->
	</div>
</div>
