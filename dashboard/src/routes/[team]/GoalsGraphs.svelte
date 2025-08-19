<script lang="ts">
	import GoalsScoredAndConcededGraph from './goals-scored-and-conceded/ScoredConcededPerGameGraph.svelte';
	import CleanSheetsGraph from './goals-scored-and-conceded/CleanSheetsGraph.svelte';
	import ScoredConcededOverTimeGraph from './goals-scored-and-conceded/ScoredConcededOverTimeGraph.svelte';
	import type { DashboardData } from './dashboard.types';

	export let data: DashboardData;
	export let mobileView: boolean;
</script>

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

<div class="row">
	<div class="row-graph">
		<div class="graph full-row-graph">
			<ScoredConcededOverTimeGraph data={data.data} team={data.team.name} {mobileView} />
		</div>
	</div>
</div>

<style>
	.lowered {
		margin-bottom: -9px;
	}
	.clean-sheets {
		height: 60px;
	}

	.no-bottom-margin {
		margin-bottom: 0 !important;
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

	.full-row-graph {
		margin: 0;
	}

	@media only screen and (max-width: 1000px) {
		.row {
			flex-direction: column;
			margin-bottom: 40px;
		}
		.row-graph {
			width: auto;
		}
	}

	@media only screen and (max-width: 800px) {
		.row-graph {
			margin: 0;
		}
	}

	@media only screen and (max-width: 550px) {
		.lowered {
			margin: 20px 30px 0;
		}
	}
</style>