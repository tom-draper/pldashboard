<script lang="ts">
	import FormOverTimeGraph from './FormOverTimeGraph.svelte';
	import PositionOverTimeGraph from './PositionOverTimeGraph.svelte';
	import PointsOverTimeGraph from './PointsOverTimeGraph.svelte';
	import type { DashboardData } from './dashboard.types';

	export let data: DashboardData;
	export let mobileView: boolean;
</script>

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

<style>
	.lowered {
		margin-bottom: -9px;
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