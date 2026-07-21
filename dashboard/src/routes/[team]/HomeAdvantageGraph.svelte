<script lang="ts">
	import type { PlotData, PlotLayout, PlotShape, PlotTrace } from '$lib/types';
	import { onMount, onDestroy } from 'svelte';
	import { toAlias, toInitials } from '$lib/team';
	import type { Team } from '$lib/types';
	import type { TeamsData } from './dashboard.types';

	const CONTEXT_OPACITY = 0.45;

	// The split is pooled over the most recent seasons so a single quiet season
	// doesn't swing the figure; a team promoted partway through simply
	// contributes whichever of these seasons it has data for.
	const SEASONS_BACK = 3;

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

	// Red → yellow → green anchors, mirroring --lose / --draw / --green, so the
	// headline figure's colour places the team on the leaguewide scale: the best
	// home advantage reads green, the worst red.
	const SCALE_RED = [248, 48, 39]; // #f83027
	const SCALE_YELLOW = [255, 221, 0]; // #ffdd00
	const SCALE_GREEN = [0, 254, 135]; // #00fe87

	function lerpChannel(a: number, b: number, t: number): number {
		return Math.round(a + (b - a) * t);
	}

	/** Map t in [0, 1] onto red → yellow → green (0 = worst, 1 = best). */
	function scaleColor(t: number): string {
		const clamped = Math.min(1, Math.max(0, t));
		let from: number[];
		let to: number[];
		let local: number;
		if (clamped < 0.5) {
			from = SCALE_RED;
			to = SCALE_YELLOW;
			local = clamped / 0.5;
		} else {
			from = SCALE_YELLOW;
			to = SCALE_GREEN;
			local = (clamped - 0.5) / 0.5;
		}
		return `rgb(${lerpChannel(from[0], to[0], local)}, ${lerpChannel(from[1], to[1], local)}, ${lerpChannel(from[2], to[2], local)})`;
	}

	/**
	 * Colour for the headline figure. Yellow is anchored at a level 0% gap, and
	 * each side is scaled by the league's strongest advantage in that direction,
	 * so the best home team reads full green and the worst full red while the
	 * sign of the gap always lands on the correct half of the scale.
	 */
	function computeFigureColor(data: TeamsData, delta: number): string {
		const rows = splits(data); // sorted ascending, so ends are min and max
		const minAdvantage = rows[0].delta;
		const maxAdvantage = rows[rows.length - 1].delta;
		let t: number;
		if (delta >= 0) {
			t = maxAdvantage > 0 ? 0.5 + 0.5 * (delta / maxAdvantage) : 0.5;
		} else {
			t = minAdvantage < 0 ? 0.5 - 0.5 * (delta / minAdvantage) : 0.5;
		}
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

		return {
			type: 'bar',
			orientation: 'h',
			x: rows.map((r) => r.delta),
			y: rows.map((r) => toInitials(r.team)),
			marker: {
				color: rows.map((r) => (r.delta >= 0 ? betterAtHome() : worseAtHome())),
				// Emphasis is carried by opacity rather than a third hue, so it
				// cannot collide with the diverging encoding.
				opacity: rows.map((r) => (r.team === team ? 1 : CONTEXT_OPACITY))
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
