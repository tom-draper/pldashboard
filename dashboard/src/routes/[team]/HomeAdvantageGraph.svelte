<script lang="ts">
	import type { PlotData, PlotLayout, PlotShape, PlotTrace } from '$lib/types';
	import { onMount, onDestroy } from 'svelte';
	import { toAlias, toInitials } from '$lib/team';
	import type { Team } from '$lib/types';
	import type { TeamsData } from './dashboard.types';

	// The split is pooled over the most recent seasons so a single quiet season
	// doesn't swing the figure; a team promoted partway through simply
	// contributes whichever of these seasons it has data for.
	const SEASONS_BACK = 3;

	// The same gradient the footer logo's mini bar chart uses (chartColors in
	// Footer.svelte), reversed so the scale runs worst (red) → best (green). The
	// same scale colours both the headline figure and the bars.
	const SCALE_STOPS = [
		[255, 0, 0], // #ff0000
		[255, 95, 0], // #ff5f00
		[255, 175, 0], // #ffaf00
		[255, 215, 0], // #ffd700
		[223, 255, 0], // #dfff00
		[125, 255, 66], // #7dff42
		[0, 254, 135] // #00fe87
	];

	function lerpChannel(a: number, b: number, t: number): number {
		return Math.round(a + (b - a) * t);
	}

	/** Map t in [0, 1] across the gradient stops (0 = worst/red, 1 = best/green). */
	function scaleColor(t: number): string {
		const clamped = Math.min(1, Math.max(0, t));
		const scaled = clamped * (SCALE_STOPS.length - 1);
		const i = Math.min(SCALE_STOPS.length - 2, Math.floor(scaled));
		const local = scaled - i;
		const from = SCALE_STOPS[i];
		const to = SCALE_STOPS[i + 1];
		return `rgb(${lerpChannel(from[0], to[0], local)}, ${lerpChannel(from[1], to[1], local)}, ${lerpChannel(from[2], to[2], local)})`;
	}

	/**
	 * Position of a delta on the [0, 1] colour scale. Yellow (0.5) is anchored at
	 * a level 0% gap; each side is scaled by the league's strongest advantage in
	 * that direction, so the sign always lands on the correct half of the scale.
	 */
	function scaleT(delta: number, minAdvantage: number, maxAdvantage: number): number {
		if (delta >= 0) {
			return maxAdvantage > 0 ? 0.5 + 0.5 * (delta / maxAdvantage) : 0.5;
		}
		return minAdvantage < 0 ? 0.5 - 0.5 * (delta / minAdvantage) : 0.5;
	}

	/** Colour for a delta, ranked against the rest of the league. */
	function deltaColor(delta: number, minAdvantage: number, maxAdvantage: number): string {
		return scaleColor(scaleT(delta, minAdvantage, maxAdvantage));
	}

	/** Colour for the headline figure, ranked against the rest of the league. */
	function computeFigureColor(data: TeamsData, delta: number): string {
		const rows = splits(data); // sorted ascending, so ends are min and max
		return deltaColor(delta, rows[0].delta, rows[rows.length - 1].delta);
	}

	/**
	 * Colour for the home win rate quoted in the caption, ranked between the
	 * lowest and highest home win rate in the league. Unlike the headline gap
	 * this has no natural zero, so it is a straight min → max relative scale
	 * (the weakest home record reads red, the strongest green).
	 */
	function computeHomeRateColor(data: TeamsData, homeRatio: number): string {
		const rates = splits(data).map((r) => r.homeRatio);
		const min = Math.min(...rates);
		const max = Math.max(...rates);
		const t = max > min ? (homeRatio - min) / (max - min) : 0.5;
		return scaleColor(t);
	}

	type Split = {
		team: Team;
		homeRatio: number;
		awayRatio: number;
		homePlayed: number;
		awayPlayed: number;
		delta: number;
	};

	/**
	 * The home/away win-ratio split for a team, pooled over the most recent
	 * SEASONS_BACK seasons ending at `latestSeason`.
	 *
	 * Ratios are recombined from summed wins and games rather than averaged, so
	 * seasons with more matches carry proportionally more weight.
	 *
	 * The stored `homeAdvantage` field compares home against *overall*, which
	 * includes the home games, making it exactly half of the home-vs-away gap.
	 * The away ratio is recovered from the two so the chart can show the full
	 * gap, which is the figure that means something to a reader.
	 */
	function homeAwaySplit(data: TeamsData, team: Team, latestSeason: number): Split {
		let homeWins = 0;
		let homePlayed = 0;
		let overallWins = 0;
		let overallPlayed = 0;

		for (let season = latestSeason; season > latestSeason - SEASONS_BACK; season--) {
			const seasonData = data.homeAdvantages[team]?.[season];
			if (seasonData == null) {
				continue;
			}
			homeWins += seasonData.home.winRatio * seasonData.home.played;
			homePlayed += seasonData.home.played;
			overallWins += seasonData.overall.winRatio * seasonData.overall.played;
			overallPlayed += seasonData.overall.played;
		}

		const homeRatio = homePlayed > 0 ? homeWins / homePlayed : 0;
		const awayPlayed = overallPlayed - homePlayed;
		const awayRatio = awayPlayed > 0 ? (overallWins - homeWins) / awayPlayed : 0;

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
		const minAdvantage = rows[0].delta;
		const maxAdvantage = rows[rows.length - 1].delta;

		return {
			type: 'bar',
			orientation: 'h',
			x: rows.map((r) => r.delta),
			y: rows.map((r) => toInitials(r.team)),
			// Every bar is full opacity so the hues read true to the scale; the
			// focused team is picked out by its bold, darkened y-axis label instead.
			marker: {
				color: rows.map((r) => deltaColor(r.delta, minAdvantage, maxAdvantage))
			},
			// Only the team in focus is labelled; a number on every bar is noise.
			text: rows.map((r) => (r.team === team ? formatDelta(r.delta) : '')),
			textposition: 'outside',
			// customdata carries the raw counts so a reader can judge the sample,
			// plus the full team name so the hover reads in full while the axis
			// stays on the short codes.
			customdata: rows.map((r) => [
				Math.round(r.homeRatio * 100),
				Math.round(r.awayRatio * 100),
				r.homePlayed,
				r.awayPlayed,
				toAlias(r.team)
			]),
			hovertemplate:
				'<b>%{customdata[4]}</b><br>' +
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

	/**
	 * Category tick labels for the y-axis. The focused team's code is bolded and
	 * darkened so it stands out now that every bar is full opacity. The order (and
	 * so tickvals) is stable across team switches; only the styling moves.
	 */
	function yAxisTicks(rows: Split[], team: Team): { tickvals: string[]; ticktext: string[] } {
		return {
			tickvals: rows.map((r) => toInitials(r.team)),
			ticktext: rows.map((r) =>
				r.team === team
					? `<span style="color: #1c0d2d"><b>${toInitials(r.team)}</b></span>`
					: toInitials(r.team)
			)
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

	function defaultLayout(team: Team, rows: Split[]): PlotLayout {
		const teamCount = rows.length;
		const { tickvals, ticktext } = axisTicks(rows);
		const yTicks = yAxisTicks(rows, team);
		return {
			title: { text: '' },
			autosize: true,
			height: Math.max(300, teamCount * 21 + 56),
			margin: { r: 60, l: 55, t: 10, b: 40, pad: 5 },
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
				tickmode: 'array',
				tickvals: yTicks.tickvals,
				ticktext: yTicks.ticktext,
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
			layout: defaultLayout(team, rows),
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
		relayout({ 'margin.l': 45, 'margin.r': 40 });
	}

	function setDefaultLayout() {
		if (!setup) {
			return;
		}
		relayout({ 'margin.l': 55, 'margin.r': 60 });
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
		// Move the bold/dark highlight onto the newly selected team's label.
		relayout({ 'yaxis.ticktext': yAxisTicks(splits(data), team).ticktext });
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
	$: figureColor = computeFigureColor(data, split.delta);
	$: homeRateColor = computeHomeRateColor(data, split.homeRatio);

	export let data: TeamsData, team: Team, mobileView: boolean;
</script>

<div class="home-advantage">
	<div class="summary">
		<!-- A single value is a stat tile, not a one-bar chart. The colour ranks
		     this team's gap against the rest of the league (red → green). -->
		<div class="figure" style="color: {figureColor}">
			{formatDelta(split.delta)}
		</div>
		<div class="caption">
			{#if split.delta >= 0}
				{toAlias(team)} win
				<b style="color: {homeRateColor}">{Math.round(split.homeRatio * 100)}%</b>
				of their
				{split.homePlayed} home games, against
				<b>{Math.round(split.awayRatio * 100)}%</b> of their {split.awayPlayed} away.
			{:else}
				{toAlias(team)} win
				<b style="color: {homeRateColor}">{Math.round(split.homeRatio * 100)}%</b>
				of their
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
