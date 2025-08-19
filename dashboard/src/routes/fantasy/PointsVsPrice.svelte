<script lang="ts">
	import { onMount } from 'svelte';
	import type { FantasyData, Page, Position, Team } from './fantasy.types';
	import type { Config, Layout, PlotData } from 'plotly.js';

	// Props
	export let data: FantasyData;
	export let page: Page;
	export let mobileView: boolean;

	// Constants
	const POSITION_COLORS: Record<Position, string> = {
		Forward: '#c600d8',
		Midfielder: '#00fe87',
		Defender: '#2dbaff',
		Goalkeeper: '#280936'
	} as const;

	const CHART_CONFIG: Config = {
		responsive: true,
		showSendToCloud: false,
		displayModeBar: false
	};

	// State
	let plotDiv: HTMLDivElement;
	let plotData: { data: PlotData[]; layout: Layout; config: Config };
	let isSetup = false;

	// Utility functions
	function isTeam(value: string): value is Team {
		return value !== '_id';
	}

	function createScatterData(data: FantasyData): PlotData {
		const processedData = processTeamData(data);
		
		return {
			x: processedData.points,
			y: processedData.price,
			name: 'Fantasy Players',
			mode: 'markers',
			type: 'scatter',
			marker: {
				size: processedData.sizes,
				opacity: 0.75,
				color: processedData.colors
			},
			customdata: processedData.playtimes,
			text: processedData.teams,
			hovertemplate: `<b>%{text}</b><br><b>£%{y}m</b><br><b>%{x} points</b><br>%{customdata}% playtime<extra></extra>`,
			showlegend: false
		};
	}

	function processTeamData(data: FantasyData) {
		const teams: Team[] = [];
		const points: number[] = [];
		const price: number[] = [];
		const minutes: number[] = [];
		const colors: string[] = [];
		let maxMinutes = 0;

		// Process team data
		Object.entries(data).forEach(([team, teamData]) => {
			if (!isTeam(team)) return;

			teams.push(team);
			points.push(teamData.totalPoints ?? 0);
			price.push((teamData.price ?? 0) / 10);
			
			const playerMinutes = (teamData.minutes ?? 0) / 2;
			minutes.push(playerMinutes);
			maxMinutes = Math.max(maxMinutes, playerMinutes);
			
			colors.push(POSITION_COLORS[teamData.position]);
		});

		// Calculate sizes and playtimes
		const sizes = minutes.map(m => m / (maxMinutes * 0.02));
		const playtimes = minutes.map(m => ((m / maxMinutes) * 100).toFixed(1));

		return { teams, points, price, minutes, colors, sizes, playtimes };
	}

	function createDefaultLayout(): Layout {
		return {
			title: false,
			autosize: true,
			margin: { r: 20, l: 60, t: 0, b: 40, pad: 5 },
			hovermode: 'closest',
			plot_bgcolor: 'transparent',
			paper_bgcolor: 'transparent',
			height: 700,
			yaxis: {
				title: { text: 'Price' },
				gridcolor: 'rgba(128, 128, 128, 0.2)',
				showgrid: true,
				showline: false,
				zeroline: false,
				fixedrange: true,
				visible: true,
				range: [0, null]
			},
			xaxis: {
				title: { text: 'Points' },
				linecolor: 'black',
				gridcolor: 'rgba(128, 128, 128, 0.2)',
				showgrid: true,
				showline: false,
				fixedrange: true,
				range: [0, null]
			},
			dragmode: false
		};
	}

	function buildPlotData(data: FantasyData) {
		return {
			data: [createScatterData(data)],
			layout: createDefaultLayout(),
			config: CHART_CONFIG
		};
	}

	function applyDesktopLayout() {
		if (!isSetup) return;

		const layoutUpdate: Partial<Layout> = {
			'yaxis.title': { text: 'Price' },
			'yaxis.visible': true,
			'yaxis.tickvals': Array.from({ length: 20 }, (_, i) => i + 1),
			'margin.l': 60,
			'margin.t': 15
		};
		
		Plotly.update(plotDiv, {}, layoutUpdate, 0);
	}

	function applyMobileLayout() {
		if (!isSetup) return;

		const layoutUpdate: Partial<Layout> = {
			'yaxis.title': null,
			'yaxis.visible': false,
			'yaxis.tickvals': Array.from({ length: 10 }, (_, i) => i + 2),
			'margin.l': 20,
			'margin.t': 5
		};

		const originalSizes = plotData.data[0].marker.size as number[];
		const mobileSizes = originalSizes.map(size => Math.round(size / 2));
		
		const dataUpdate = {
			marker: {
				size: mobileSizes,
				color: plotData.data[0].marker.color,
				opacity: 0.75
			}
		};

		// Update stored data
		plotData.data[0].marker.size = mobileSizes;

		Plotly.update(plotDiv, dataUpdate, layoutUpdate, 0);
	}

	async function initializePlot() {
		plotData = buildPlotData(data);
		
		const plot = await Plotly.newPlot(
			plotDiv, 
			plotData.data, 
			plotData.layout, 
			plotData.config
		) as HTMLDivElement;

		// Add CSS classes for responsive behavior
		const chartContainer = plot.children[0]?.children[0];
		if (chartContainer) {
			chartContainer.classList.add('resizable-graph', 'tall-graph');
		}
	}

	function refreshPlot() {
		if (!isSetup) return;

		const newPlotData = buildPlotData(data);
		plotData.data[0] = newPlotData.data[0];

		Plotly.redraw(plotDiv);
		
		// Apply appropriate layout for current view
		if (mobileView) {
			applyMobileLayout();
		}
	}

	// Lifecycle
	onMount(async () => {
		await initializePlot();
		isSetup = true;
	});

	// Reactive statements
	$: if (isSetup && page) {
		refreshPlot();
	}

	$: if (isSetup) {
		if (mobileView) {
			applyMobileLayout();
		} else {
			applyDesktopLayout();
		}
	}
</script>

<div id="plotly">
	<div id="plotDiv" bind:this={plotDiv}>
		<!-- Plotly chart will be drawn inside this DIV -->
	</div>
</div>