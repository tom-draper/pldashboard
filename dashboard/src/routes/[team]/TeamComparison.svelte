<script lang="ts">
	import SpiderGraph from './spider-graph/SpiderGraph.svelte';
	import type { DashboardData } from './dashboard.types';

	export let data: DashboardData;
</script>

<div class="row">
	<div class="spider-chart-row row-graph">
		<h1>Team Comparison</h1>
		<div class="spider-chart-container">
			<SpiderGraph data={data.data} team={data.team.name} teams={data.teams} />
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

	.spider-chart-row {
		display: grid;
		place-items: center;
	}
	.spider-chart-container {
		margin: 1em auto auto;
		display: flex;
	}

	@media only screen and (max-width: 1000px) {
		.row {
			flex-direction: column;
			margin-bottom: 40px;
		}
		.row-graph {
			width: auto;
		}

		.spider-chart-container {
			flex-direction: column;
			width: 100%;
		}
	}
</style>