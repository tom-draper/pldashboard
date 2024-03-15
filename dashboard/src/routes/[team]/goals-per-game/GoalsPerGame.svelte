<script lang="ts">
	import { onMount } from 'svelte';
	import GoalsScoredFreq from './GoalsScoredFreqGraph.svelte';
	import GoalsConcededFreq from './GoalsConcededFreqGraph.svelte';
	import type { TeamsData, Team } from '../dashboard.types';
	import { getTeams } from '../team';

	function avgBars() {
		return {
			x: Object.keys(goalFreq),
			y: Object.values(goalFreq),
			type: 'bar',
			name: 'Avg',
			marker: { color: '#C6C6C6' },
			line: { width: 0 },
			hovertemplate: `Average %{x} with probability <b>%{y:.2f}</b><extra></extra>`,
			hoverinfo: 'x+y'
		};
	}

	function teamBars(data: Counter, type: string, color: string | string[]) {
		const opener = type === 'Scored' ? 'Score' : 'Concede';
		return {
			x: Object.keys(data),
			y: Object.values(data),
			type: 'bar',
			name: type,
			marker: { color: color },
			hovertemplate: `${opener} %{x} with probability <b>%{y:.2f}</b><extra></extra>`,
			line: { width: 0 },
			hoverinfo: 'x+y',
			opacity: 0.5
		};
	}

	function bars(data: Counter, name: string, color: string | string[]) {
		return [avgBars(), teamBars(data, name, color)];
	}

	// Basic color scale shared between the two bar chars
	const colorScale = ['#00fe87', '#aef23e', '#ffdd00', '#ff9000', '#f83027'];

	// Concatenate unique extreme colors, for extreme values that only a few teams achieve
	// Concatenate bright greens
	const scoredColorScale = reversed(colorScale).concat([
		'#00fe87',
		'#00fe87',
		'#00fe87',
		'#00fe87',
		'#00fe87'
	]);
	// Concatenate bright reds
	const concededColorScale = colorScale.concat([
		'#f83027',
		'#f83027',
		'#f83027',
		'#f83027',
		'#f83027'
	]);

	function reversed(arr: any[]) {
		return arr.slice().reverse();
	}

	function getScoredBars() {
		// return bars(teamScoredFreq, "Goals scored", "#77DD77");
		return bars(teamScoredFreq, 'Scored', scoredColorScale);
	}

	function getConcededBars() {
		return bars(teamConcededFreq, 'Conceded', concededColorScale);
	}

	function getScoredTeamBars() {
		return teamBars(teamScoredFreq, 'Scored', scoredColorScale);
	}

	function getConcededTeamBars() {
		return teamBars(teamConcededFreq, 'Conceded', concededColorScale);
	}

	function getXLabels(): string[] {
		return Object.keys(goalFreq);
	}

	function getYAxisLayout() {
		return {
			title: { text: 'Probability' },
			gridcolor: 'gray',
			showgrid: false,
			showline: false,
			zeroline: false,
			fixedrange: true,
			autorange: false,
			range: [0, maxY]
		};
	}

	function countScored(data: TeamsData, goalFreq: Counter, season: number, team: Team) {
		for (const matchday in data.form[team][season]) {
			const score = data.form[team][season][matchday].score;
			if (score == null) {
				continue;
			}
			if (data.form[team][season][matchday].atHome) {
				if (score.homeGoals in goalFreq) {
					goalFreq[score.homeGoals] += 1;
				} else {
					goalFreq[score.homeGoals] = 1;
				}
			} else {
				if (score.awayGoals in goalFreq) {
					goalFreq[score.awayGoals] += 1;
				} else {
					goalFreq[score.awayGoals] = 1;
				}
			}
		}
	}

	function maxObjKey(obj: Record<string, number>): number {
		let max = 0;
		for (const goals in obj) {
			const g = parseInt(goals);
			if (g > max) {
				max = g;
			}
		}
		return max;
	}

	function fillGoalFreqBlanks(goalFreq: Counter) {
		const max = maxObjKey(goalFreq);
		for (let i = 1; i < max; i++) {
			if (!(i in goalFreq)) {
				goalFreq[i] = 0;
			}
		}
	}

	function avgGoalFrequencies(data: TeamsData) {
		const goalFreq: Counter = {};
		const teams = getTeams(data)
		for (const team of teams) {
			countScored(data, goalFreq, data._id, team);
			countScored(data, goalFreq, data._id - 1, team);
		}

		fillGoalFreqBlanks(goalFreq);

		// Divide by number of teams to get avg
		for (const goals in goalFreq) {
			goalFreq[goals] /= 20;
		}

		return goalFreq;
	}

	function teamScoredFrequencies(data: TeamsData, team: Team) {
		const goalFreq = {};
		countScored(data, goalFreq, data._id, team);
		countScored(data, goalFreq, data._id - 1, team);
		fillGoalFreqBlanks(goalFreq);

		return goalFreq;
	}

	function countConceded(data: TeamsData, goalFreq: Counter, season: number, team: Team) {
		for (const matchday in data.form[team][season]) {
			const score = data.form[team][season][matchday].score;
			if (score == null) {
				continue;
			}
			if (data.form[team][season][matchday].atHome) {
				if (score.awayGoals in goalFreq) {
					goalFreq[score.awayGoals] += 1;
				} else {
					goalFreq[score.awayGoals] = 1;
				}
			} else {
				if (score.homeGoals in goalFreq) {
					goalFreq[score.homeGoals] += 1;
				} else {
					goalFreq[score.homeGoals] = 1;
				}
			}
		}
	}

	function teamConcededFrequencies(data: TeamsData, team: Team) {
		const goalFreq = {};
		countConceded(data, goalFreq, data._id, team);
		countConceded(data, goalFreq, data._id - 1, team);
		fillGoalFreqBlanks(goalFreq);

		return goalFreq;
	}

	function checkForMax(freq: Counter, max: number): number {
		return Math.max(max, ...Object.values(freq));
	}

	function maxValue(goalFreq: Counter, teamScoredFreq: Counter, teamConcededFreq: Counter): number {
		let max = 0;
		max = checkForMax(goalFreq, max);
		max = checkForMax(teamScoredFreq, max);
		max = checkForMax(teamConcededFreq, max);
		return max;
	}

	function valueSum(obj: Counter): number {
		return Object.values(obj).reduce((total, freq) => total + freq, 0);
	}

	function scaleTeamFreq(goalFreq: Counter, teamScoredFreq: Counter, teamConcededFreq: Counter) {
		const totalGoalFreq = valueSum(goalFreq);

		const totalTeamScoredFreq = valueSum(teamScoredFreq);
		for (const goals in teamScoredFreq) {
			teamScoredFreq[goals] *= totalGoalFreq / totalTeamScoredFreq;
		}

		const totalTeamConcededFreq = valueSum(teamConcededFreq);
		for (const goals in teamConcededFreq) {
			teamConcededFreq[goals] *= totalGoalFreq / totalTeamConcededFreq;
		}
	}

	function convertToPercentage(freq: Counter) {
		const totalFreq = valueSum(freq);
		for (const goals in freq) {
			freq[goals] /= totalFreq;
		}
	}

	function convertAllToPercentage(
		goalFreq: Counter,
		teamScoredFreq: Counter,
		teamConcededFreq: Counter
	) {
		convertToPercentage(goalFreq);
		convertToPercentage(teamScoredFreq);
		convertToPercentage(teamConcededFreq);
	}

	function refreshTeamData() {
		if (!setup) {
			return;
		}

		teamScoredFreq = teamScoredFrequencies(data, team);
		teamConcededFreq = teamConcededFrequencies(data, team);
		scaleTeamFreq(goalFreq, teamScoredFreq, teamConcededFreq);
		convertToPercentage(teamScoredFreq);
		convertToPercentage(teamConcededFreq);
		maxY = maxValue(goalFreq, teamScoredFreq, teamConcededFreq);
	}

	let goalFreq: Counter;
	let teamScoredFreq: Counter;
	let teamConcededFreq: Counter;
	let maxY: number;
	let setup = false;
	onMount(() => {
		goalFreq = avgGoalFrequencies(data);
		teamScoredFreq = teamScoredFrequencies(data, team);
		teamConcededFreq = teamConcededFrequencies(data, team);
		scaleTeamFreq(goalFreq, teamScoredFreq, teamConcededFreq);
		convertAllToPercentage(goalFreq, teamScoredFreq, teamConcededFreq);
		maxY = maxValue(goalFreq, teamScoredFreq, teamConcededFreq);
		setup = true;
	});

	$: team && refreshTeamData();

	export let data: TeamsData, team: Team, mobileView: boolean;
</script>

<div class="two-graphs">
	{#if setup}
		<div class="graph freq-graph mini-graph">
			<GoalsScoredFreq
				{team}
				{getScoredBars}
				{getScoredTeamBars}
				{getXLabels}
				{getYAxisLayout}
				{mobileView}
			/>
		</div>
		<div class="graph freq-graph mini-graph">
			<GoalsConcededFreq
				{team}
				{getConcededBars}
				{getConcededTeamBars}
				{getXLabels}
				{getYAxisLayout}
				{mobileView}
			/>
		</div>
	{/if}
</div>

<style scoped>
	.two-graphs {
		display: flex;
		margin: 0 8%;
	}
	.freq-graph {
		width: 50%;
	}

	@media only screen and (max-width: 1000px) {
		.two-graphs {
			display: flex;
			margin: 0;
		}
	}
</style>
