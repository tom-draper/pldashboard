<script lang="ts">
	import { onMount } from 'svelte';
	import { toAlias, toName, getTeamID, teamColor } from '$lib/team';
	import type { SpiderAttribute, TeamsData } from '../dashboard.types';
	import getAttack from './attack';
	import { removeItem } from './util';
	import getCleanSheets from './cleanSheets';
	import getConsistency from './consistency';
	import getVsBig6 from './vsBig6';
	import getWinStreak from './winStreak';
	import getDefence from './defence';
	import type { Team } from '$lib/types';
	import type Plotly from 'plotly.js';

	function addTeamComparison(team: Team) {
		const teamData: Plotly.Data = {
			name: team,
			type: 'scatterpolar',
			r: [
				attack.teams[team],
				defence.teams[team],
				cleanSheets.teams[team],
				consistency.teams[team],
				winStreaks.teams[team],
				vsBig6.teams[team]
			],
			theta: labels,
			fill: 'toself',
			marker: { color: teamColor(team) },
			hovertemplate: `<b>${team}</b><br>%{theta}: %{r:.2f}<extra></extra>`
		};
		plotData.data.push(teamData);

		//@ts-ignore
		Plotly.redraw(plotDiv); // Redraw with teamName added
	}

	function addAvg() {
		const avg = avgScatterPlot();
		plotData.data.unshift(avg); // Add avg below the teamName spider plot
	}

	function removeTeamComparison(team: Team) {
		// Remove spider plot for this teamName
		for (let i = 0; i < plotData.data.length; i++) {
			if (plotData.data[i].name === team) {
				plotData.data.splice(i, 1);
				break;
			}
		}

		// If removing only comparison teamName, re-insert the initial avg spider plot
		if (comparisonTeams.length === 1) {
			addAvg();
		}

		//@ts-ignore
		Plotly.redraw(plotDiv); // Redraw with teamName removed
	}

	function removeAllTeamComparisons(team: Team) {
		for (const _team of comparisonTeams) {
			// Remove spider plot for this teamName
			for (let i = 0; i < plotData.data.length; i++) {
				if (plotData.data[i].name === _team && _team != team) {
					plotData.data.splice(i, 1);
					break;
				}
			}

			// If removing only comparison teamName, re-insert the initial avg spider plot
			if (comparisonTeams.length === 1) {
				addAvg();
			}
			removeItem(comparisonTeams, _team); // Remove from comparison teams
		}

		//@ts-ignore
		Plotly.redraw(plotDiv); // Redraw with teamName removed
	}

	function resetTeamComparisonBtns() {
		const btns = document.getElementById('spider-opp-teams');
		if (btns === null) {
			return;
		}

		for (let i = 0; i < btns.children.length; i++) {
			//@ts-ignore
			const btn: HTMLButtonElement = btns.children[i];
			if (btn.style.background === '') {
				continue;
			}
			btn.style.background = '';
			btn.style.color = 'black';
		}
	}

	function spiderBtnClick(btn: HTMLButtonElement) {
		const team = toName(btn.innerHTML) as Team;
		if (btn.style.background === '') {
			const teamKey = getTeamID(team);
			btn.style.background = `var(--${teamKey})`;
			btn.style.color = `var(--${teamKey}-secondary)`;
		} else {
			btn.style.background = '';
			btn.style.color = 'var(--pink)';
		}

		if (comparisonTeams.length === 0) {
			plotData.data.splice(0, 1); // Remove avg
		}

		if (comparisonTeams.includes(team)) {
			removeTeamComparison(team); // Remove from spider chart
			removeItem(comparisonTeams, team); // Remove from comparison teams
		} else {
			addTeamComparison(team); // Add teamName to spider chart
			comparisonTeams.push(team); // Add to comparison teams
		}
	}

	function scatterPlot(name: string, r: number[], color: string): Plotly.Data {
		return {
			name: name,
			type: 'scatterpolar',
			r: r,
			theta: labels,
			fill: 'toself',
			marker: { color: color },
			hovertemplate: `<b>${name}</b><br>%{theta}: %{r:.2f}<extra></extra>`,
			hoveron: 'points'
		};
	}

	function avgScatterPlot() {
		const avgData = scatterPlot(
			'Avg',
			[attack.avg, defence.avg, cleanSheets.avg, consistency.avg, winStreaks.avg, vsBig6.avg],
			'#ADADAD'
		);
		return avgData;
	}

	function getTeamData(team: Team) {
		const teamData = scatterPlot(
			team,
			[
				attack.teams[team],
				defence.teams[team],
				cleanSheets.teams[team],
				consistency.teams[team],
				winStreaks.teams[team],
				vsBig6.teams[team]
			],
			teamColor(team)
		);
		return teamData;
	}

	function initSpiderPlots(team: Team) {
		const avgData = avgScatterPlot();
		const teamData = getTeamData(team);
		return [avgData, teamData];
	}

	function computePlotData(data: TeamsData) {
		attack = getAttack(data);
		defence = getDefence(data);
		cleanSheets = getCleanSheets(data, numSeasons);
		consistency = getConsistency(data, numSeasons);
		winStreaks = getWinStreak(data, numSeasons);
		vsBig6 = getVsBig6(data, numSeasons);
	}

	function defaultLayout() {
		const layout: Plotly.Layout = {
			height: 550,
			polar: {
				radialaxis: {
					visible: true,
					range: [0, 100]
				}
			},
			// @ts-ignore
			hover: 'closest',
			margin: { t: 25, b: 25, l: 75, r: 75 },
			showlegend: false,
			plot_bgcolor: '#fafafa',
			paper_bgcolor: '#fafafa',
			dragmode: false
		};
		return layout;
	}

	function buildPlotData(data: TeamsData, team: Team) {
		computePlotData(data);

		const spiderPlots = initSpiderPlots(team);

		const plotData: Plotly.PlotlyDataLayoutConfig = {
			data: spiderPlots,
			layout: defaultLayout(),
			config: {
				responsive: true,
				showSendToCloud: false,
				displayModeBar: false
			}
		};
		return plotData;
	}

	const numSeasons = 3;
	let attack: SpiderAttribute;
	let defence: SpiderAttribute;
	let cleanSheets: SpiderAttribute;
	let consistency: SpiderAttribute;
	let winStreaks: SpiderAttribute;
	let vsBig6: SpiderAttribute;
	const labels = ['Attack', 'Defence', 'Clean sheets', 'Consistency', 'Win streak', 'Vs big 6'];

	let plotDiv: HTMLDivElement, plotData: Plotly.PlotlyDataLayoutConfig;
	const comparisonTeams: Team[] = [];
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
			plot.children[0].children[0].classList.add('resizable-spider-chart');
		});
	}

	function emptyArray(arr: any[]) {
		for (let i = 0; i < arr.length; i++) {
			arr.pop();
		}
	}

	function refreshPlot() {
		if (!setup) {
			return;
		}
		const spiderPlots = initSpiderPlots(team);
		// Remove all but two plots
		emptyArray(plotData.data);
		// Replace final two plots with defaults
		plotData.data.push(spiderPlots[0]); // Reset to avg
		plotData.data.push(spiderPlots[1]); // Reset to team data

		removeAllTeamComparisons(team);
		resetTeamComparisonBtns();
	}

	$: team && refreshPlot();

	export let data: TeamsData, team: Team, teams: Team[];
</script>

<div class="spider-chart">
	<div id="plotly">
		<div id="plotDiv" bind:this={plotDiv}>
			<!-- Plotly chart will be drawn inside this DIV -->
		</div>
	</div>
</div>
<div class="spider-opp-team-selector">
	<div class="spider-opp-team-btns" id="spider-opp-teams">
		{#each teams as _team, i}
			{#if _team != team}
				<button
					class="spider-opp-team-btn"
					class:top-spider-opp-team-btn={i === 0 || (teams[0] === team && i === 1)}
					class:bottom-spider-opp-team-btn={i === teams.length - 1 ||
						(teams[teams.length - 1] === team && i === teams.length - 2)}
					on:click={(e) => {
						//@ts-ignore
						spiderBtnClick(e.target);
					}}>{toAlias(_team)}</button
				>
			{/if}
		{/each}
	</div>
</div>

<style scoped>
	.spider-chart {
		position: relative;
	}
	.spider-opp-team-selector {
		display: flex;
		flex-direction: column;
		margin: auto;
		z-index: 1;
	}
	.spider-opp-team-btns {
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		width: 180px;
	}
	.spider-opp-team-btn {
		cursor: pointer;
		color: #333333;
		border: none;
		font-size: 13px;
		padding: 4px 10px;
		background: var(--purple);
		color: var(--pink);
	}
	button {
		margin: 0 !important;
		padding: 4 10px !important;
	}
	.spider-opp-team-btn:hover {
		background: var(--dark-purple);
	}

	.top-spider-opp-team-btn {
		border-radius: 4px 4px 0 0;
	}

	.bottom-spider-opp-team-btn {
		border-radius: 0 0 4px 4px;
	}
</style>
