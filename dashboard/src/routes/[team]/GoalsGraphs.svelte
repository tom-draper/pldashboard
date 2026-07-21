<script lang="ts">
	import GoalsScoredAndConcededGraph from './goals-scored-and-conceded/ScoredConcededPerGameGraph.svelte';
	import CleanSheetsGraph from './goals-scored-and-conceded/CleanSheetsGraph.svelte';
	import ScoredConcededOverTimeGraph from './goals-scored-and-conceded/ScoredConcededOverTimeGraph.svelte';
	import type { DashboardData } from './dashboard.types';

	export let data: DashboardData;
	export let mobileView: boolean;
</script>

<div class="relative mb-0 flex h-auto max-[1000px]:flex-col">
	<div class="w-full max-[1000px]:w-auto">
		<h1 class="mb-[-9px] max-[550px]:mx-[30px] max-[550px]:mt-[20px] max-[550px]:mb-0">
			Goals Per Game
		</h1>
		<div class="m-0">
			<GoalsScoredAndConcededGraph
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
		<div class="m-0 h-[60px]">
			<CleanSheetsGraph
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
		<div class="m-0">
			<ScoredConcededOverTimeGraph data={data.data} team={data.team.name} {mobileView} />
		</div>
	</div>
</div>
