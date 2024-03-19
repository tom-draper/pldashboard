<script lang="ts">
	import CurrentForm from './current-form/CurrentForm.svelte';
	import TableSnippet from './TableSnippet.svelte';
	import NextGame from './NextGame.svelte';
	import StatsValues from './goals-scored-and-conceded/StatsValues.svelte';
	import FixturesGraph from './FixturesGraph.svelte';
	import FormOverTimeGraph from './FormOverTimeGraph.svelte';
	import PositionOverTimeGraph from './PositionOverTimeGraph.svelte';
	import PointsOverTimeGraph from './PointsOverTimeGraph.svelte';
	import GoalsScoredAndConcededGraph from './goals-scored-and-conceded/ScoredConcededPerGameGraph.svelte';
	import CleanSheetsGraph from './goals-scored-and-conceded/CleanSheetsGraph.svelte';
	import GoalsPerGame from './goals-per-game/GoalsPerGame.svelte';
	import SpiderGraph from './spider-graph/SpiderGraph.svelte';
	import ScorelineFreqGraph from './ScorelineFreqGraph.svelte';
	import ScoredConcededOverTimeGraph from './goals-scored-and-conceded/ScoredConcededOverTimeGraph.svelte';
	import type { DashboardData } from './dashboard.types';
	import type { Team } from '$lib/types';

	let pageWidth: number;
	$: mobileView = pageWidth <= 700;

	export let data: DashboardData, switchTeam: (newTeam: Team) => void;
</script>

<svelte:window bind:innerWidth={pageWidth} />

<div class="page-content">
	<div class="row multi-element-row small-bottom-margin">
		<div class="row-left position-no-badge">
			<div class="circles-background-container">
				<svg class="circles-background">
					<circle
						cx="300"
						cy="150"
						r="100"
						stroke-width="0"
						fill="var(--{data.team.id}-secondary)"
					/>
					<circle cx="170" cy="170" r="140" stroke-width="0" fill="var(--{data.team.id})" />
					<circle cx="300" cy="320" r="170" stroke-width="0" fill="var(--{data.team.id})" />
				</svg>
			</div>
			<div class="position-central">
				{data.data.standings[data.team.name][data.data._id].position}
			</div>
		</div>
		<div class="row-right fixtures-graph row-graph">
			<h1 class="lowered">Fixtures</h1>
			<div class="graph mini-graph mobile-margin">
				<FixturesGraph data={data.data} team={data.team.name} {mobileView} />
			</div>
		</div>
	</div>

	<div class="row multi-element-row">
		<div class="row-left form-details">
			<CurrentForm data={data.data} currentMatchday={data.currentMatchday} team={data.team.name} />
			<TableSnippet data={data.data} teamID={data.team.id} team={data.team.name} {switchTeam} />
		</div>
		<div class="row-right">
			<NextGame data={data.data} team={data.team.name} {switchTeam} />
		</div>
	</div>

	<div class="row">
		<div class="form-graph row-graph">
			<h1 class="lowered">Form</h1>
			<div class="graph full-row-graph">
				<FormOverTimeGraph
					data={data.data}
					team={data.team.name}
					playedDates={data.playedDates}
					{mobileView}
				/>
			</div>
		</div>
	</div>

	<div class="row">
		<div class="position-over-time-graph row-graph">
			<h1 class="lowered">Position</h1>
			<div class="graph full-row-graph">
				<PositionOverTimeGraph data={data.data} team={data.team.name} {mobileView} />
			</div>
		</div>
	</div>

	<div class="row">
		<div class="position-over-time-graph row-graph">
			<h1 class="lowered">Points</h1>
			<div class="graph full-row-graph">
				<PointsOverTimeGraph data={data.data} team={data.team.name} {mobileView} />
			</div>
		</div>
	</div>

	<div class="row no-bottom-margin">
		<div class="goals-scored-vs-conceded-graph row-graph">
			<h1 class="lowered">Goals Per Game</h1>
			<div class="graph full-row-graph">
				<GoalsScoredAndConcededGraph
					data={data.data}
					team={data.team.name}
					playedDates={data.playedDates}
					{mobileView}
				/>
			</div>
		</div>
	</div>

	<div class="row">
		<div class="row-graph">
			<div class="clean-sheets graph full-row-graph">
				<CleanSheetsGraph
					data={data.data}
					team={data.team.name}
					playedDates={data.playedDates}
					{mobileView}
				/>
			</div>
		</div>
	</div>

	<div class="season-stats-row">
		<StatsValues data={data.data} team={data.team.name} />
	</div>

	<div class="row">
		<div class="row-graph">
			<div class="graph full-row-graph">
				<ScoredConcededOverTimeGraph data={data.data} team={data.team.name} {mobileView} />
			</div>
		</div>
	</div>

	<div class="row">
		<div class="goals-freq-row row-graph">
			<h1>Scorelines</h1>
			<GoalsPerGame data={data.data} team={data.team.name} {mobileView} />
		</div>
	</div>

	<div class="row">
		<div class="row-graph">
			<div class="score-freq graph">
				<ScorelineFreqGraph data={data.data} team={data.team.name} {mobileView} />
			</div>
		</div>
	</div>

	<div class="row">
		<div class="spider-chart-row row-graph">
			<h1>Team Comparison</h1>
			<div class="spider-chart-container">
				<SpiderGraph data={data.data} team={data.team.name} teams={data.teams} />
			</div>
		</div>
	</div>
</div>

<style scoped>
	.lowered {
		margin-bottom: -9px;
	}
	.page-content {
		position: relative;
	}

	.position-no-badge {
		padding-left: 0;
		margin: 0;
		height: 500px;
	}

	.position-central {
		text-shadow: 9px 9px #000;
		font-weight: 800;
		font-size: 430px;
		user-select: none;
		max-width: 500px;
	}

	.position-central {
		text-align: center;
		margin-top: 0.1em;
		max-height: 500px;
		margin-left: 0.05em;
		font-size: 20vw;
		color: #333;
	}

	.circles-background-container {
		position: absolute;
		align-self: center;
		width: 500px;
		z-index: -10;
	}

	.circles-background {
		height: 500px;
		width: 500px;
		transform: scale(0.95);
	}

	.fixtures-graph {
		display: flex;
		flex-direction: column;
	}

	.clean-sheets {
		height: 60px;
	}

	.no-bottom-margin {
		margin-bottom: 0 !important;
	}
	.small-bottom-margin {
		margin-bottom: 1.5rem !important;
	}
	.page-content {
		display: flex;
		flex-direction: column;
		text-align: center;
	}

	.row {
		position: relative;
		display: flex;
		margin-bottom: 3rem;
		height: auto;
	}
	.row-graph {
		width: 100%;
	}
	.score-freq {
		margin: 0 8% 0 8%;
	}
	.row-left {
		display: flex;
		flex-direction: column;
		padding-right: auto;
		margin-right: 1.5em;
		text-justify: center;
		flex: 4;
	}
	.row-right {
		flex: 10;
	}
	.multi-element-row {
		margin: 0 1.4em 3rem;
	}

	.spider-chart-row {
		display: grid;
		place-items: center;
	}
	.spider-chart-container {
		margin: 1em auto auto;
		display: flex;
	}

	@media only screen and (min-width: 2400px) {
		.position-central {
			font-size: 16vw;
		}
	}
	@media only screen and (min-width: 2200px) {
		.position-central {
			font-size: 18vw;
		}
	}
	@media only screen and (min-width: 2000px) {
		.position-central {
			font-size: 20vw;
		}
	}
	@media only screen and (max-width: 1800px) {
		.circles-background {
			transform: scale(0.9);
		}
		.position-central {
			font-size: 20vw;
			margin-top: 0.2em;
		}
	}
	@media only screen and (max-width: 1600px) {
		.row-left {
			flex: 5;
		}
		.circles-background {
			transform: scale(0.85);
		}
	}
	@media only screen and (max-width: 1500px) {
		.circles-background {
			transform: scale(0.8);
		}
		.position-central {
			font-size: 22vw;
		}
	}
	@media only screen and (max-width: 1400px) {
		.circles-background {
			transform: scale(0.75);
		}
		.position-central {
			margin-top: 0.25em;
		}
	}

	@media only screen and (max-width: 1200px) {
		.position-central {
			margin-top: 0.3em;
		}
		.circles-background {
			transform: scale(0.7);
		}
		.position-central {
			font-size: 24vw;
		}
	}

	@media only screen and (min-width: 1100px) {
		.form-details {
			width: 80%;
			align-items: center;
		}
	}

	@media only screen and (max-width: 1000px) {
		.row {
			flex-direction: column;
			margin-bottom: 40px;
		}
		.row-graph {
			width: auto;
		}
		.score-freq {
			margin: 0 0 10px;
		}

		.multi-element-row {
			margin: 0;
		}
		.row-left {
			margin-right: 0;
			align-self: center;
			width: 80%;
		}

		.position-no-badge {
			height: 400px;
			width: 500px;
		}
		.position-central {
			margin: auto;
		}

		.circles-background {
			transform: scale(0.48);
			margin-top: -100px;
		}

		.position-central,
		.circles-background-container {
			align-self: center;
		}
		.spider-chart-container {
			flex-direction: column;
			width: 100%;
		}
		.full-row-graph {
			margin: 0;
		}
	}

	@media only screen and (max-width: 900px) {
		.circles-background {
			transform: scale(0.45);
			margin-top: -120px;
		}
		.position-central {
			font-size: 25vw;
		}
	}

	@media only screen and (max-width: 700px) {
		.circles-background {
			transform: scale(0.55);
			margin-top: -5em;
		}

		.position-no-badge {
			height: 330px;
		}

		.position-central {
			font-size: 250px;
			margin: 35px 0 0 0;
		}
	}

	@media only screen and (max-width: 800px) {
		.circles-background {
			transform: scale(0.4);
			margin-top: -9em;
		}
		.position-central {
			font-size: 13em;
		}
		.season-stats-row {
			margin: 1em;
		}
		.row-graph {
			margin: 0;
		}
	}

	@media only screen and (max-width: 550px) {
		.position-central {
			font-size: 10em;
			text-align: center;
			line-height: 1.55;
			padding-right: 20px;
			margin: 0;
			text-shadow: 7px 7px #000;
		}
		.multi-element-row {
			margin: 0;
		}

		.season-stats-row {
			margin: 0 1em 1em;
		}
		.form-details {
			width: 95%;
		}
		.position-no-badge {
			padding: 0 !important;
			margin: 0 !important;
			width: 100%;
		}

		.circles-background {
			transform: scale(0.35);
			margin-top: -9.5em;
		}

		.lowered {
			margin: 0 30px;
		}
	}
</style>
