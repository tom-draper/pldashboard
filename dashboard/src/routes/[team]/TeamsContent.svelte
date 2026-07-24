<script lang="ts">
	import PositionAndFixtures from './PositionAndFixtures.svelte';
	import type { DashboardData } from './dashboard.types';
	import type { Team } from '$lib/types';
	import GoalsGraphs from './GoalsGraphs.svelte';
	import TeamGraphs from './TeamGraphs.svelte';
	import FormAndNextGame from './FormAndNextGame.svelte';
	import Scorelines from './Scorelines.svelte';
	import TeamComparison from './TeamComparison.svelte';

	const { data, switchTeam }: { data: DashboardData; switchTeam: (newTeam: Team) => void } =
		$props();

	let pageWidth = $state<number>();
	// Undefined until the window binds (and during SSR), which counts as desktop,
	// matching the pre-runes `undefined <= 700` behaviour.
	const mobileView = $derived(pageWidth !== undefined && pageWidth <= 700);
</script>

<svelte:window bind:innerWidth={pageWidth} />

<div class="relative flex flex-col text-center max-[550px]:overflow-x-hidden">
	<PositionAndFixtures {data} />
	<FormAndNextGame {data} {switchTeam} />
	<TeamGraphs {data} {mobileView} />
	<GoalsGraphs {data} {mobileView} />
	<Scorelines {data} {mobileView} />
	<TeamComparison {data} />
</div>
