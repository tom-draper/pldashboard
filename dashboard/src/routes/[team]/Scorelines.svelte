<script lang="ts">
	import GoalsPerGame from './goals-per-game/GoalsPerGame.svelte';
	import ScorelineFreqGraph from './ScorelineFreqGraph.svelte';
	import type { DashboardData } from './dashboard.types';

	export let data: DashboardData;
	export let mobileView: boolean;
</script>

<div class="relative mb-[3rem] flex h-auto max-[1000px]:mb-[40px] max-[1000px]:flex-col">
	<div class="w-full max-[1000px]:w-auto">
		<h1>Scorelines</h1>
		<GoalsPerGame data={data.data} team={data.team.name} {mobileView} />
	</div>
</div>

<div class="relative mb-[3rem] flex h-auto max-[1000px]:mb-[40px] max-[1000px]:flex-col">
	<div class="w-full max-[1000px]:w-auto">
		<div class="mx-[8%] max-[1000px]:mx-0 max-[1000px]:mb-[10px]">
			<ScorelineFreqGraph data={data.data} team={data.team.name} {mobileView} />
		</div>
	</div>
</div>
