<script lang="ts">
	import FormOverTimeGraph from './FormOverTimeGraph.svelte';
	import HomeAdvantageGraph from './HomeAdvantageGraph.svelte';
	import PositionOverTimeGraph from './PositionOverTimeGraph.svelte';
	import PointsOverTimeGraph from './PointsOverTimeGraph.svelte';
	import Row from './Row.svelte';
	import type { DashboardData } from './dashboard.types';

	export let data: DashboardData;
	export let mobileView: boolean;
</script>

<Row>
	<div class="w-full max-[1000px]:w-auto">
		<h1 class="mb-[-9px] max-[550px]:mx-[30px] max-[550px]:mt-[20px] max-[550px]:mb-0">Form</h1>
		<div class="m-0">
			<FormOverTimeGraph
				data={data.data}
				team={data.team.name}
				playedDates={data.playedDates}
				{mobileView}
			/>
		</div>
	</div>
</Row>

<Row>
	<div class="w-full max-[1000px]:w-auto">
		<h1 class="mb-[-9px] max-[550px]:mx-[30px] max-[550px]:mt-[20px] max-[550px]:mb-0">Position</h1>
		<div class="m-0">
			<PositionOverTimeGraph data={data.data} team={data.team.name} {mobileView} />
		</div>
	</div>
</Row>

<Row>
	<div class="w-full max-[1000px]:w-auto">
		<h1 class="mb-[-9px] max-[550px]:mx-[30px] max-[550px]:mt-[20px] max-[550px]:mb-0">Points</h1>
		<div class="m-0">
			<PointsOverTimeGraph data={data.data} team={data.team.name} {mobileView} />
		</div>
	</div>
</Row>

<Row>
	<div class="w-full max-[1000px]:w-auto">
		<h1 class="mb-[-9px] max-[550px]:mx-[30px] max-[550px]:mt-[20px] max-[550px]:mb-0">
			Home Advantage
		</h1>
		<div class="m-0">
			<HomeAdvantageGraph data={data.data} team={data.team.name} {mobileView} />
		</div>
	</div>
</Row>
