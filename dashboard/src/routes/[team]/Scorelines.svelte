<script lang="ts">
	import GoalsPerGame from './goals-per-game/GoalsPerGame.svelte';
	import ScorelineFreqGraph from './ScorelineFreqGraph.svelte';
	import Row from './Row.svelte';
	import type { DashboardData } from './dashboard.types';

	export let data: DashboardData;
	export let mobileView: boolean;
</script>

<Row>
	<div class="w-full max-[1000px]:w-auto">
		<h1>Scorelines</h1>
		<GoalsPerGame data={data.data} team={data.team.name} {mobileView} />
	</div>
</Row>

<Row>
	<div class="w-full max-[1000px]:w-auto">
		<div class="mx-[8%] max-[1000px]:mx-0 max-[1000px]:mb-[10px]">
			<ScorelineFreqGraph data={data.data} team={data.team.name} {mobileView} />
		</div>
	</div>
</Row>
