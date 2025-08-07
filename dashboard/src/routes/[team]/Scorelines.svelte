<script lang="ts">
	import GoalsPerGame from './goals-per-game/GoalsPerGame.svelte';
	import ScorelineFreqGraph from './ScorelineFreqGraph.svelte';
	import type { DashboardData } from './dashboard.types';

	export let data: DashboardData;
	export let mobileView: boolean;
</script>

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

<style>
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
	}
</style>