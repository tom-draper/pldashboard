<script lang="ts">
	import PositionAndFixtures from './PositionAndFixtures.svelte';
	import type { DashboardData } from './dashboard.types';
	import type { Team } from '$lib/types';
	import GoalsGraphs from './GoalsGraphs.svelte';
	import TeamGraphs from './TeamGraphs.svelte';
	import FormAndNextGame from './FormAndNextGame.svelte';
	import Scorelines from './Scorelines.svelte';
	import TeamComparison from './TeamComparison.svelte';

	let pageWidth: number;
	$: mobileView = pageWidth <= 700;

	export let data: DashboardData, switchTeam: (newTeam: Team) => void;
</script>

<svelte:window bind:innerWidth={pageWidth} />

<div class="page-content">
	<PositionAndFixtures {data} />
	<FormAndNextGame {data} {switchTeam} />
	<TeamGraphs {data} {mobileView} />
	<GoalsGraphs {data} {mobileView} />
	<Scorelines {data} {mobileView} />
	<TeamComparison {data} />
</div>

<style scoped>
	.page-content {
		position: relative;
		display: flex;
		flex-direction: column;
		text-align: center;
	}
</style>
