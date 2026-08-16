<script lang="ts">
	import PositionAndFixtures from './PositionAndFixtures.svelte';
	import type { DashboardData } from './dashboard.types';
	import type { Team } from '$lib/types';
	import GoalsGraphs from './GoalsGraphs.svelte';
	import TeamGraphs from './TeamGraphs.svelte';
	import FormAndNextGame from './FormAndNextGame.svelte';
	import Scorelines from './Scorelines.svelte';
	import TeamComparison from './TeamComparison.svelte';
	import { mobileView } from '$lib/mobileView.svelte';

	const { data, switchTeam }: { data: DashboardData; switchTeam: (newTeam: Team) => void } =
		$props();

	const mobile = mobileView();
</script>

<div class="relative flex flex-col text-center max-[550px]:overflow-x-hidden">
	<PositionAndFixtures {data} />
	<FormAndNextGame {data} {switchTeam} />
	<TeamGraphs {data} mobileView={mobile.current} />
	<GoalsGraphs {data} mobileView={mobile.current} />
	<Scorelines {data} mobileView={mobile.current} />
	<TeamComparison {data} />
</div>
