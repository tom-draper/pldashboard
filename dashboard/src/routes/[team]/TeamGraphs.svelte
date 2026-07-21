<script lang="ts">
	import FormOverTimeGraph from './FormOverTimeGraph.svelte';
	import HomeAdvantageGraph from './HomeAdvantageGraph.svelte';
	import PositionOverTimeGraph from './PositionOverTimeGraph.svelte';
	import PointsOverTimeGraph from './PointsOverTimeGraph.svelte';
	import type { DashboardData } from './dashboard.types';

	export let data: DashboardData;
	export let mobileView: boolean;
</script>

<div class="relative mb-[3rem] flex h-auto max-[1000px]:mb-[40px] max-[1000px]:flex-col">
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
</div>

<div class="relative mb-[3rem] flex h-auto max-[1000px]:mb-[40px] max-[1000px]:flex-col">
	<div class="w-full max-[1000px]:w-auto">
		<h1 class="mb-[-9px] max-[550px]:mx-[30px] max-[550px]:mt-[20px] max-[550px]:mb-0">Position</h1>
		<div class="m-0">
			<PositionOverTimeGraph data={data.data} team={data.team.name} {mobileView} />
		</div>
	</div>
</div>

<div class="relative mb-[3rem] flex h-auto max-[1000px]:mb-[40px] max-[1000px]:flex-col">
	<div class="w-full max-[1000px]:w-auto">
		<h1 class="mb-[-9px] max-[550px]:mx-[30px] max-[550px]:mt-[20px] max-[550px]:mb-0">Points</h1>
		<div class="m-0">
			<PointsOverTimeGraph data={data.data} team={data.team.name} {mobileView} />
		</div>
	</div>
</div>

<div class="relative mb-[3rem] flex h-auto max-[1000px]:mb-[40px] max-[1000px]:flex-col">
	<div class="w-full max-[1000px]:w-auto">
		<h1 class="mb-[-9px] max-[550px]:mx-[30px] max-[550px]:mt-[20px] max-[550px]:mb-0">
			Home advantage
		</h1>
		<div class="m-0">
			<HomeAdvantageGraph data={data.data} team={data.team.name} {mobileView} />
		</div>
	</div>
</div>
