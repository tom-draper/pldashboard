<script lang="ts">
	import GoalsScoredAndConcededGraph from './goals-scored-and-conceded/ScoredConcededPerGameGraph.svelte';
	import CleanSheetsGraph from './goals-scored-and-conceded/CleanSheetsGraph.svelte';
	import ScoredConcededOverTimeGraph from './goals-scored-and-conceded/ScoredConcededOverTimeGraph.svelte';
	import Row from './Row.svelte';
	import type { DashboardData } from './dashboard.types';

	export let data: DashboardData;
	export let mobileView: boolean;
</script>

<Row class="mb-0">
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
</Row>

<Row>
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
</Row>

<Row>
	<div class="w-full max-[1000px]:w-auto">
		<div class="m-0">
			<ScoredConcededOverTimeGraph data={data.data} team={data.team.name} {mobileView} />
		</div>
	</div>
</Row>
