<script lang="ts">
	import type { PlotData, PlotTrace, PlotLayout, PlotShape } from '$lib/types';
	import { createPlotlyGraph } from '$lib/plotlyGraph.svelte';
	import Plotly, { loadPlotly } from '$lib/plotly';
	import { updatePlotlyFigure } from '$lib/plotlyLayout';
	import { toAlias } from '$lib/team';
	import { scoreline } from '$lib/format';
	import { browser } from '$app/environment';
	import type { TeamsData, Fixture } from './dashboard.types';
	import type { Team } from '$lib/types';

	// Start fetching the browser-only Plotly bundle as soon as this above-the-fold
	// component is initialised. The graph lifecycle still waits for it before drawing.
	if (browser) {
		void loadPlotly();
	}

	function matchDescription(team: Team, match: Fixture): string {
		const homeTeam = match.atHome ? toAlias(team) : toAlias(match.team);
		const awayTeam = match.atHome ? toAlias(match.team) : toAlias(team);

		if (match.score != null) {
			return scoreline(homeTeam, awayTeam, match.score.homeGoals, match.score.awayGoals);
		} else {
			return `${homeTeam} vs ${awayTeam}`;
		}
	}

	function sortByMatchDate(x: Date[], y: number[], details: string[]) {
		const temp = Array.from({ length: x.length })
			.map((_, i) => ({ x: x[i], y: y[i], details: details[i] }))
			.sort(function (a, b) {
				return a.x < b.x ? -1 : a.x == b.x ? 0 : 1;
			});

		// Unpack back into original arrays
		for (let i = 0; i < temp.length; i++) {
			x[i] = temp[i].x;
			y[i] = temp[i].y;
			details[i] = temp[i].details;
		}
	}

	function highlightNextGameMarker(sizes: number[], x: Date[], now: number, highlightSize: number) {
		// Get matchday date with smallest time difference to now
		let nextGameIdx: number | undefined;
		let minDiff = Number.POSITIVE_INFINITY;
		for (let i = 0; i < x.length; i++) {
			const diff = x[i].getTime() - now;
			if (0 < diff && diff < minDiff) {
				minDiff = diff;
				nextGameIdx = i;
			}
		}

		// Increase marker size of next game
		if (nextGameIdx != undefined) {
			sizes[nextGameIdx] = highlightSize;
		}

		return sizes;
	}

	function linePoints(data: TeamsData, team: Team): [Date[], number[], string[]] {
		const x: Date[] = [];
		const y: number[] = [];
		const descriptions: string[] = [];
		for (let matchday = 1; matchday <= 38; matchday++) {
			const match = data.fixtures[team][matchday];
			x.push(new Date(match.date));

			const oppositionRating = getOppositionTeamRating(data, match.team, match.atHome);
			y.push(oppositionRating * 100);

			const description = matchDescription(team, match);
			descriptions.push(description);
		}
		return [x, y, descriptions];
	}

	function getOppositionTeamRating(data: TeamsData, oppositionTeam: Team, atHome: boolean) {
		let oppositionRating = data.teamRatings[oppositionTeam].total;
		if (atHome) {
			// If team playing at home, decrease opposition rating by the amount of home advantage the team gains
			oppositionRating *= 1 - data.homeAdvantages[oppositionTeam].totalHomeAdvantage;
		}
		return oppositionRating;
	}

	function getLine(data: TeamsData, team: Team, now: number): PlotTrace {
		const [x, y, description] = linePoints(data, team);

		sortByMatchDate(x, y, description);

		const matchdays = Array.from({ length: 38 }, (_, index) => index + 1);

		let sizes = Array(x.length).fill(13);
		sizes = highlightNextGameMarker(sizes, x, now, 26);

		const line: PlotTrace = {
			x: x,
			y: y,
			type: 'scatter',
			mode: 'lines+markers',
			text: description,
			line: {
				color: '#737373'
			},
			marker: {
				size: sizes,
				colorscale: [
					[0, '#00fe87'],
					[0.5, '#f3f3f3'],
					[1, '#f83027']
				],
				color: y,
				opacity: 1,
				line: { width: 1 }
			},
			customdata: matchdays,
			hovertemplate:
				'<b>%{text}</b><br>Matchday %{customdata}<br>%{x|%d %b %Y}<br>Team rating: <b> %{y:.1f}%</b><extra></extra>'
		};
		return line;
	}

	function currentDateLine(now: number, maxX: number): PlotShape {
		if (now > maxX) {
			return {};
		}

		const nowLine: PlotShape = {
			type: 'line',
			x0: now,
			y0: -4,
			x1: now,
			y1: 104,
			line: {
				color: 'black',
				dash: 'dot',
				width: 1
			}
		};
		return nowLine;
	}

	function xRange(x: Date[]): [Date, Date] {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a local value used to compute the plot range, never reactive state
		const minX = new Date(x[0]);
		minX.setDate(minX.getDate() - 7);
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a local value used to compute the plot range, never reactive state
		const maxX = new Date(x[x.length - 1]);
		maxX.setDate(maxX.getDate() + 7);
		return [minX, maxX];
	}

	function defaultLayout(x: Date[], now: number): PlotLayout {
		const yLabels = Array.from(Array(11), (_, i) => i * 10);

		const [minX, maxX] = xRange(x);

		// Show  the current date line only if currently before 30 days after of the season
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a local value used to compute the plot range, never reactive state
		const currentDateLineLimit = new Date(maxX);
		currentDateLineLimit.setDate(currentDateLineLimit.getDate() + 30);
		const currentDate =
			now <= currentDateLineLimit.getTime() ? currentDateLine(now, maxX.getTime()) : null;

		const layout: PlotLayout = {
			title: { text: '' },
			autosize: true,
			margin: { r: 20, l: 60, t: 5, b: 40, pad: 5 },
			hovermode: 'closest',
			plot_bgcolor: 'transparent',
			paper_bgcolor: 'transparent',
			yaxis: {
				title: { text: 'Team rating' },
				gridcolor: '#d6d6d6',
				showline: false,
				zeroline: false,
				fixedrange: true,
				// @ts-expect-error Plotly's axis types do not allow ticktext alongside these options
				ticktext: yLabels,
				tickvals: yLabels
			},
			xaxis: {
				linecolor: 'black',
				showgrid: false,
				showline: false,
				range: [minX, maxX],
				fixedrange: true
			},
			shapes: currentDate ? [currentDate] : [],
			dragmode: false
		};
		return layout;
	}

	function setDefaultLayout() {
		const layoutUpdate = {
			'yaxis.title': { text: 'Team rating' },
			'margin.l': 60,
			'yaxis.color': 'black'
		};

		const sizes = plotData.data[0].marker!.size as number[];
		for (let i = 0; i < sizes.length; i++) {
			sizes[i] = Math.round(sizes[i] * 1.7);
		}
		const dataUpdate = {
			marker: {
				size: sizes,
				colorscale: [
					[0, '#00fe87'],
					[0.5, '#f3f3f3'],
					[1, '#f83027']
				],
				color: plotData.data[0].y,
				opacity: 1,
				line: { width: 1 }
			}
		};
		plotData.data[0].marker!.size = sizes;

		updatePlotlyFigure(plotDiv, dataUpdate, layoutUpdate, 0);
	}

	function setMobileLayout() {
		const layoutUpdate = {
			'yaxis.title': null,
			'margin.l': 20,
			'yaxis.color': '#fafafa'
		};

		const sizes = (plotData.data[0].marker!.size as number[]).map((size: number) =>
			Math.round(size / 1.7)
		);
		const dataUpdate = {
			marker: {
				size: sizes,
				colorscale: [
					[0, '#00fe87'],
					[0.5, '#f3f3f3'],
					[1, '#f83027']
				],
				color: plotData.data[0].y,
				opacity: 1,
				line: { width: 1 }
			}
		};
		plotData.data[0].marker!.size = sizes;

		updatePlotlyFigure(plotDiv, dataUpdate, layoutUpdate, 0);
	}

	function buildPlotData(data: TeamsData, team: Team) {
		// Build data to create a fixtures line graph displaying the date along the
		// x-axis and opponent strength along the y-axis
		const now = Date.now();
		const line = getLine(data, team, now);

		const plotData: PlotData = {
			data: [line],
			layout: defaultLayout(line.x as Date[], now),
			config: {
				responsive: true,
				showSendToCloud: false,
				displayModeBar: false
			}
		};
		return plotData;
	}

	let graphReady = $state(false);

	async function genPlot() {
		plotData = buildPlotData(data, team);
		await Plotly.newPlot(plotDiv, plotData.data, plotData.layout, plotData.config);
		graphReady = true;
	}

	function refreshPlot() {
		const l = getLine(data, team, Date.now());
		plotData.data[0] = l; // Overwrite plot data
		Plotly.redraw(plotDiv);
		if (mobileView) {
			setMobileLayout();
		}
	}

	let plotDiv: HTMLDivElement, plotData: PlotData;

	const { data, team, mobileView }: { data: TeamsData; team: Team; mobileView: boolean } = $props();

	createPlotlyGraph({
		getNode: () => plotDiv,
		draw: genPlot,
		initialDrawPriority: 'high',
		refresh: refreshPlot,
		applyDefaultLayout: setDefaultLayout,
		applyMobileLayout: setMobileLayout,
		isMobile: () => mobileView,
		trigger: () => team
	});
</script>

<div class="relative" aria-busy={!graphReady}>
	{#if !graphReady}
		<div class="absolute inset-0" aria-label="Loading fixtures graph">
			<svg
				class="h-full w-full animate-pulse"
				viewBox="20 0 780 450"
				role="img"
				aria-hidden="true"
				preserveAspectRatio="none"
			>
				<style>
					.fixtures-skeleton-point {
						transform-box: fill-box;
						transform-origin: center;
						transform: scaleX(0.78);
					}
				</style>
				<g stroke="#e5e5e5" stroke-width="1">
					<line x1="60" y1="15" x2="780" y2="15" />
					<line x1="60" y1="59" x2="780" y2="59" />
					<line x1="60" y1="103" x2="780" y2="103" />
					<line x1="60" y1="147" x2="780" y2="147" />
					<line x1="60" y1="191" x2="780" y2="191" />
					<line x1="60" y1="234" x2="780" y2="234" />
					<line x1="60" y1="278" x2="780" y2="278" />
					<line x1="60" y1="322" x2="780" y2="322" />
					<line x1="60" y1="366" x2="780" y2="366" />
					<line x1="60" y1="410" x2="780" y2="410" />
				</g>
				<line
					x1="455"
					y1="15"
					x2="455"
					y2="410"
					stroke="#d4d4d4"
					stroke-dasharray="3 3"
					stroke-width="1"
				/>
				<polyline
					points="60,55 102,174 144,390 186,138 228,246 270,195 312,310 354,94 396,260 438,115 480,225 522,291 564,171 606,242 648,131 690,279 732,204 780,153"
					fill="none"
					stroke="#a3a3a3"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1"
				/>
				<g fill="#bdbdbd">
					<circle class="fixtures-skeleton-point" cx="60" cy="55" r="4" />
					<circle class="fixtures-skeleton-point" cx="102" cy="174" r="4" />
					<circle class="fixtures-skeleton-point" cx="144" cy="390" r="4" />
					<circle class="fixtures-skeleton-point" cx="186" cy="138" r="4" />
					<circle class="fixtures-skeleton-point" cx="228" cy="246" r="4" />
					<circle class="fixtures-skeleton-point" cx="270" cy="195" r="4" />
					<circle class="fixtures-skeleton-point" cx="312" cy="310" r="4" />
					<circle class="fixtures-skeleton-point" cx="354" cy="94" r="4" />
					<circle class="fixtures-skeleton-point" cx="396" cy="260" r="4" />
					<circle class="fixtures-skeleton-point" cx="438" cy="115" r="4" />
					<circle class="fixtures-skeleton-point" cx="480" cy="225" r="4" />
					<circle class="fixtures-skeleton-point" cx="522" cy="291" r="4" />
					<circle class="fixtures-skeleton-point" cx="564" cy="171" r="4" />
					<circle class="fixtures-skeleton-point" cx="606" cy="242" r="4" />
					<circle class="fixtures-skeleton-point" cx="648" cy="131" r="4" />
					<circle class="fixtures-skeleton-point" cx="690" cy="279" r="4" />
					<circle class="fixtures-skeleton-point" cx="732" cy="204" r="4" />
					<circle class="fixtures-skeleton-point" cx="780" cy="153" r="4" />
				</g>
			</svg>
		</div>
	{/if}
	<div
		class="resizable-graph transition-opacity duration-300"
		class:opacity-0={!graphReady}
		bind:this={plotDiv}
	>
		<!-- Plotly chart will be drawn inside this DIV -->
	</div>
</div>
