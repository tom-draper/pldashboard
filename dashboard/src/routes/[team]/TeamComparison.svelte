<script lang="ts">
	import SpiderGraph from './spider-graph/SpiderGraph.svelte';
	import Row from './Row.svelte';
	import type { DashboardData } from './dashboard.types';

	export let data: DashboardData;
</script>

<Row>
	<div class="grid w-full place-items-center max-[1000px]:w-auto">
		<h1>Team Comparison</h1>
		<div class="mx-auto mt-[1em] mb-auto flex max-[1000px]:w-full max-[1000px]:flex-col">
			<SpiderGraph data={data.data} team={data.team.name} teams={data.teams} />
		</div>
	</div>
</Row>
