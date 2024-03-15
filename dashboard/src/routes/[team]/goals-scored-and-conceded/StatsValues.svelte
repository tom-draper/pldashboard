<script lang="ts">
	import { onMount } from 'svelte';
	import { ordinal } from '../format';
	import { isCleanSheet, notScored, goalsScored, goalsConceded } from '../goals';
	import type { Team, TeamsData } from '../dashboard.types';
	import { getTeams } from '../team';

	function getStatsRank(
		seasonStats: Stats,
		attribute: keyof Stats[Team],
		team: Team,
		reverse: boolean
	): number {
		const teams = Object.keys(seasonStats) as Team[];
		const sorted = teams.sort(function (team1, team2) {
			return seasonStats[team2][attribute] - seasonStats[team1][attribute];
		});
		let rank = sorted.indexOf(team) + 1;
		if (reverse) {
			rank = 21 - rank;
		}
		return rank;
	}

	function getStatsRankings(seasonStats: Stats, team: Team): StatsRank {
		const xGRank = getStatsRank(seasonStats, 'xG', team, false);
		// Reverse - lower rank the better
		const xCRank = getStatsRank(seasonStats, 'xC', team, true);
		const cleanSheetRatioRank = getStatsRank(seasonStats, 'cleanSheetRatio', team, false);
		return {
			xG: `${xGRank}${ordinal(xGRank)}`,
			xC: `${xCRank}${ordinal(xCRank)}`,
			cleanSheetRatio: `${cleanSheetRatioRank}${ordinal(cleanSheetRatioRank)}`
		};
	}

	function setStatsValues(seasonStats: Stats, team: Team) {
		rank = getStatsRankings(seasonStats, team);

		// Keep ordinal values at the correct offset
		// Once rank values have updated, init positional offset for ordinal values
		// window.addEventListener("resize", setPositionalOffset);
	}

	function teamSeasonStats(data: TeamsData, team: Team, season: number) {
		if (!(team in data.form)) {
			return null;
		}

		const seasonStats = {
			cleanSheetRatio: 0,
			noGoalRatio: 0,
			xG: 0,
			xC: 0,
			played: 0
		};

		for (const matchday in data.form[team][season]) {
			const score = data.form[team][season][matchday].score;
			if (score == null) {
				continue;
			}
			const atHome = data.form[team][season][matchday].atHome ?? false;
			if (isCleanSheet(score.homeGoals, score.awayGoals, atHome)) {
				seasonStats.cleanSheetRatio += 1;
			}
			if (notScored(score.homeGoals, score.awayGoals, atHome)) {
				seasonStats.noGoalRatio += 1;
			}
			seasonStats.xG += goalsScored(score.homeGoals, score.awayGoals, atHome);
			seasonStats.xC += goalsConceded(score.homeGoals, score.awayGoals, atHome);
			seasonStats.played += 1;
		}
		return seasonStats;
	}

	function buildStats(data: TeamsData) {
		const stats: {[team in Team]?: Stats[Team]} = {}

		const calculateAverage = (value: number, played: number): number => {
			return played === 0 ? 0 : value / played;
		};

		const teams = getTeams(data)
		for (const team of teams) {
			const currentSeasonStats = teamSeasonStats(data, team, data._id);
			if (currentSeasonStats == null) {
				continue;
			}
			const prevSeasonStats = teamSeasonStats(data, team, data._id - 1);
			if (prevSeasonStats == null) {
				continue;
			}

			const played = currentSeasonStats.played + prevSeasonStats.played;
			if (played === 0) {
				continue;
			}

			const xG = currentSeasonStats.xG + prevSeasonStats.xG;
			const xC = currentSeasonStats.xC + prevSeasonStats.xC;
			const cleanSheetRatio = currentSeasonStats.cleanSheetRatio + prevSeasonStats.cleanSheetRatio;
			const noGoalRatio = currentSeasonStats.noGoalRatio + prevSeasonStats.noGoalRatio;

			stats[team] = {
				played,
				xG: calculateAverage(xG, played),
				xC: calculateAverage(xC, played),
				cleanSheetRatio: calculateAverage(cleanSheetRatio, played),
				noGoalRatio: calculateAverage(noGoalRatio, played)
			};
		}

		return stats as Stats;
	}

	function refreshStatsValues() {
		if (!setup) {
			return;
		}

		setStatsValues(stats, team);
	}

	type Stats = {
		[team in Team]: {
			played: number;
			xG: number;
			xC: number;
			cleanSheetRatio: number;
			noGoalRatio: number;
		};
	};

	type StatsRank = {
		xG: string;
		xC: string;
		cleanSheetRatio: string;
	};

	let stats: Stats;
	let rank: StatsRank = {
		xG: '',
		xC: '',
		cleanSheetRatio: ''
	};
	let setup = false;
	onMount(() => {
		stats = buildStats(data);
		stats;
		setStatsValues(stats, team);
		setup = true;
	});

	$: team && refreshStatsValues();

	export let data: TeamsData, team: Team;
</script>

{#if stats != undefined}
	<div class="season-stats">
		<div class="season-stat goals-per-game">
			<div class="season-stat-value">
				<div class="season-stat-position hidden">
					{rank.xG}
				</div>
				<div class="season-stat-number">
					{stats[team].xG.toFixed(2)}
				</div>
				<div class="season-stat-position ssp-{rank.xG}">
					{rank.xG}
				</div>
			</div>
			<div class="season-stat-text">goals per game</div>
		</div>
		<div class="season-stat conceded-per-game">
			<div class="season-stat-value">
				<div class="season-stat-position hidden">
					{rank.xC}
				</div>
				<div class="season-stat-number">
					{stats[team].xC.toFixed(2)}
				</div>
				<div class="season-stat-position ssp-{rank.xC}">
					{rank.xC}
				</div>
			</div>
			<div class="season-stat-text">conceded per game</div>
		</div>
		<div class="season-stat clean-sheet-ratio">
			<div class="season-stat-value">
				<div class="season-stat-position hidden">
					{rank.cleanSheetRatio}
				</div>
				<div class="season-stat-number">
					{stats[team].cleanSheetRatio.toFixed(2)}
				</div>
				<div class="season-stat-position ssp-{rank.cleanSheetRatio}">
					{rank.cleanSheetRatio}
				</div>
			</div>
			<div class="season-stat-text">clean sheets</div>
		</div>
	</div>
{/if}

<style scoped>
	.ssp-1st {
		color: var(--green);
	}
	.ssp-2nd {
		color: #48f98f;
	}
	.ssp-3rd {
		color: #65f497;
	}
	.ssp-4th {
		color: #7aef9f;
	}
	.ssp-5th {
		color: #8ceaa7;
	}
	.ssp-6th {
		color: #9be4af;
	}
	.ssp-7th {
		color: #a9deb6;
	}
	.ssp-8th {
		color: #b6d9bd;
	}
	.ssp-9th {
		color: #c1d2c5;
	}
	.ssp-10th {
		color: #cccccc;
	}
	.ssp-11th {
		color: #cccccc;
	}
	.ssp-12th {
		color: #d7beb9;
	}
	.ssp-13th {
		color: #e0b0a6;
	}
	.ssp-14th {
		color: #e7a293;
	}
	.ssp-15th {
		color: #ed9380;
	}
	.ssp-16th {
		color: #f1836e;
	}
	.ssp-17th {
		color: #f4735c;
	}
	.ssp-18th {
		color: #f6604b;
	}
	.ssp-19th {
		color: #f84c39;
	}
	.ssp-20th {
		color: #f83027;
	}
	.season-stats {
		display: flex;
		font-size: 2.2em;
		width: 100%;
		letter-spacing: -0.06em;
	}

	.season-stat-value {
		font-size: 3.2em;
		line-height: 0.6em;
		font-weight: 700;
		width: fit-content;
		margin: 0 auto;
		position: relative;
		user-select: none;
		display: flex;
	}

	.season-stat-position {
		font-size: 0.3em;
		line-height: 0;
		margin-left: 0.2em;
	}
	.hidden {
		color: transparent;
	}

	.season-stat {
		flex: 1;
	}

	@media only screen and (max-width: 1400px) {
		.season-stat-value {
			font-size: 2.5em;
		}

		.season-stats-row {
			margin: 70px 0 10px;
		}

		.season-stat-text {
			font-size: 0.9em;
		}
	}

	@media only screen and (max-width: 800px) {
		.season-stats {
			flex-direction: column;
		}

		.season-stat-text {
			font-size: 0.9em;
		}
		.season-stat {
			margin: 0.5em 0 0.9em 0;
		}

		.season-stat-value {
			font-size: 2.5em;
		}

		.season-stat-text {
			font-size: 0.9em;
		}
	}

	@media only screen and (max-width: 550px) {
		.season-stat-value {
			font-size: 1.4em;
			letter-spacing: 0.01em;
		}

		.season-stat {
			margin: 0.25em 0 0.45em 0;
		}
		.season-stat-position {
			font-size: 0.5em;
			top: -0.5em;
		}
		.season-stat-text {
			letter-spacing: -0.04em;
			font-size: 0.7em;
		}
	}
</style>
