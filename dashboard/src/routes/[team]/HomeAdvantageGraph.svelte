<script lang="ts">
	import type { PlotData, PlotLayout, PlotShape, PlotTrace } from '$lib/types';
	import { onMount, onDestroy } from 'svelte';
	import { toAlias } from '$lib/team';
	import type { Team } from '$lib/types';
	import type { TeamsData } from './dashboard.types';

	const CONTEXT_OPACITY = 0.45;

	// Plotly cannot read CSS custom properties, so --green is resolved at run
	// time the same way the other charts do it. Note it measures 1.32:1 against
	// the chart surface, below the 3:1 mark contrast guideline: the direct label
	// on the emphasised bar and the hover values are what keep it readable.
	function cssVar(name: string, fallback: string): string {
		if (typeof document === 'undefined') {
			return fallback;
		}
		const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
		return value || fallback;
	}

	const betterAtHome = () => cssVar('--green', '#00fe87');
	// --lose is the same #f83027 the other charts hardcode, just named.
	const worseAtHome = () => cssVar('--lose', '#f83027');

	type Split = {
		team: Team;
		homeRatio: number;
		awayRatio: number;
		homePlayed: number;
		awayPlayed: number;
		delta: number;
	};

	/**
	 * The home/away win-ratio split for a team.
	 *
	 * The stored `homeAdvantage` field compares home against *overall*, which
	 * includes the home games, making it exactly half of the home-vs-away gap.
	 * The away ratio is recovered from the two so the chart can show the full
	 * gap, which is the figure that means something to a reader.
	 */
	function homeAwaySplit(data: TeamsData, team: Team, season: number): Split {
		const seasonData = data.homeAdvantages[team][season];
		const { played: homePlayed, winRatio: homeRatio } = seasonData.home;
		const { played: overallPlayed, winRatio: overallRatio } = seasonData.overall;

		const awayPlayed = overallPlayed - homePlayed;
		const awayRatio =
			awayPlayed > 0 ? (overallRatio * overallPlayed - homeRatio * homePlayed) / awayPlayed : 0;

		return {
			team,
			homeRatio,
			awayRatio,
			homePlayed,
			awayPlayed,
			delta: homeRatio - awayRatio
		};
	}

	function splits(data: TeamsData): Split[] {
		return Object.keys(data.homeAdvantages)
			.map((t) => homeAwaySplit(data, t as Team, data._id))
			.sort((a, b) => a.delta - b.delta); // ascending: largest ends up on top
	}

	function bars(data: TeamsData, team: Team): PlotTrace {
		const rows = splits(data);

		return {
			type: 'bar',
			orientation: 'h',
			x: rows.map((r) => r.delta),
			y: rows.map((r) => toAlias(r.team)),
			marker: {
				color: rows.map((r) => (r.delta >= 0 ? betterAtHome() : worseAtHome())),
				// Emphasis is carried by opacity rather than a third hue, so it
				// cannot collide with the diverging encoding.
				opacity: rows.map((r) => (r.team === team ? 1 : CONTEXT_OPACITY))
			},
			// Only the team in focus is labelled; a number on every bar is noise.
			text: rows.map((r) => (r.team === team ? formatDelta(r.delta) : '')),
			textposition: 'outside',
			// customdata carries the raw counts so a reader can judge the sample.
			customdata: rows.map((r) => [
				Math.round(r.homeRatio * 100),
				Math.round(r.awayRatio * 100),
				r.homePlayed,
				r.awayPlayed
			]),
			hovertemplate:
				'<b>%{y}</b><br>' +
				'Home: %{customdata[0]}% of %{customdata[2]} won<br>' +
				'Away: %{customdata[1]}% of %{customdata[3]} won<br>' +
				'Gap: %{x:+.0%}<extra></extra>',
			showlegend: false
		};
	}

	// Percentage points, but "pts" would read as league points in a football
	// context, so the difference is shown as a percentage and the axis title
	// spells out what it is a difference of.
	function formatDelta(delta: number): string {
		const points = Math.round(delta * 100);
		return `${points >= 0 ? '+' : ''}${points}%`;
	}

	/**
	 * Symmetric ticks at 10% steps, labelled here rather than by tickformat.
	 * Plotly's generated zero tick is JavaScript negative zero, which d3's
	 * percentage format renders as "-0%"; adding 0 normalises it.
	 */
	function axisTicks(rows: Split[]) {
		const widest = Math.max(0.1, ...rows.map((r) => Math.abs(r.delta)));
		const limit = Math.ceil(widest * 10) / 10;

		const tickvals: number[] = [];
		for (let step = -Math.round(limit * 10); step <= Math.round(limit * 10); step++) {
			tickvals.push(step / 10);
		}
		return {
			tickvals,
			ticktext: tickvals.map((value) => `${Math.round(value * 100) + 0}%`)
		};
	}

	/** The neutral anchor the bars diverge from. */
	function zeroLine(teamCount: number): PlotShape {
		return {
			type: 'line',
			x0: 0,
			x1: 0,
			y0: -0.5,
			y1: teamCount - 0.5,
			layer: 'below',
			line: { color: '#d3d3d3', width: 2 }
		};
	}

	function defaultLayout(teamCount: number, rows: Split[]): PlotLayout {
		const { tickvals, ticktext } = axisTicks(rows);
		return {
			title: { text: '' },
			autosize: true,
			height: Math.max(300, teamCount * 21 + 56),
			margin: { r: 60, l: 130, t: 10, b: 40, pad: 5 },
			hovermode: 'closest',
			plot_bgcolor: '#fafafa',
			paper_bgcolor: '#fafafa',
			bargap: 0.22,
			xaxis: {
				title: { text: 'Home win rate minus away win rate' },
				tickmode: 'array',
				tickvals,
				ticktext,
				zeroline: false,
				showgrid: false,
				showline: false,
				fixedrange: true
			},
			yaxis: {
				showgrid: false,
				showline: false,
				zeroline: false,
				fixedrange: true,
				automargin: true
			},
			shapes: [zeroLine(teamCount)],
			dragmode: false,
			showlegend: false
		};
	}

	function buildPlotData(data: TeamsData, team: Team): PlotData {
		const rows = splits(data);
		return {
			data: [bars(data, team)],
			layout: defaultLayout(rows.length, rows),
			config: {
				responsive: true,
				showSendToCloud: false,
				displayModeBar: false
			}
		};
	}

	// Plotly.relayout takes dotted attribute paths, which Partial<Layout> cannot
	// express.
	function relayout(update: Record<string, unknown>) {
		Plotly.relayout(plotDiv, update as Parameters<typeof Plotly.relayout>[1]);
	}

	function setMobileLayout() {
		if (!setup) {
			return;
		}
		relayout({ 'margin.l': 90, 'margin.r': 40 });
	}

	function setDefaultLayout() {
		if (!setup) {
			return;
		}
		relayout({ 'margin.l': 130, 'margin.r': 60 });
	}

	function genPlot() {
		plotData = buildPlotData(data, team);
		Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config);
	}

	function refreshPlot() {
		if (!setup) {
			return;
		}
		plotData.data[0] = bars(data, team);
		Plotly.redraw(plotDiv);
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

	$: team && refreshPlot();
	$: !mobileView && setDefaultLayout();
	$: setup && mobileView && setMobileLayout();

	$: split = homeAwaySplit(data, team, data._id);

	export let data: TeamsData, team: Team, mobileView: boolean;
</script>

<div class="home-advantage">
	<div class="summary">
		<!-- A single value is a stat tile, not a one-bar chart. -->
		<div class="figure" class:negative={split.delta < 0}>
			{formatDelta(split.delta)}
		</div>
		<div class="caption">
			{#if split.delta >= 0}
				{toAlias(team)} win <b>{Math.round(split.homeRatio * 100)}%</b> of their
				{split.homePlayed} home games, against
				<b>{Math.round(split.awayRatio * 100)}%</b> of their {split.awayPlayed} away.
			{:else}
				{toAlias(team)} win <b>{Math.round(split.homeRatio * 100)}%</b> of their
				{split.homePlayed} home games — fewer than the
				<b>{Math.round(split.awayRatio * 100)}%</b> they win away.
			{/if}
		</div>
	</div>

	<div>
		<div bind:this={plotDiv}>
			<!-- Plotly chart will be drawn inside this DIV -->
		</div>
	</div>
</div>

<style>
	.summary {
		/* Breathing room under the section heading, which sits tight by design. */
		margin: 1.6em 0 1em;
		text-align: center;
	}
	.figure {
		font-size: 2.6em;
		font-weight: 600;
		line-height: 1.1;
		color: var(--green);
	}
	.figure.negative {
		color: var(--lose);
	}
	.caption {
		font-size: 0.9em;
		color: #555;
		max-width: 46em;
		margin: 0 auto;
	}
	@media only screen and (max-width: 550px) {
		.figure {
			font-size: 2em;
		}
	}
</style>
