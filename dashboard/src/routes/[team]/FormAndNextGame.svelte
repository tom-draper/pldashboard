<script lang="ts">
	import CurrentForm from './current-form/CurrentForm.svelte';
	import TableSnippet from './TableSnippet.svelte';
	import NextGame from './NextGame.svelte';
	import Row from './Row.svelte';
	import type { DashboardData } from './dashboard.types';
	import type { Team } from '$lib/types';

	export let data: DashboardData, switchTeam: (newTeam: Team) => void;
</script>

<Row class="mx-[1.4em] mt-0 mb-[3rem] max-[1000px]:m-0">
	<div
		class="flex flex-[4] flex-col mr-[1.5em] min-[1100px]:w-[80%] min-[1100px]:items-center max-[1000px]:mr-0 max-[1000px]:w-[80%] max-[1000px]:self-center max-[550px]:w-[95%]"
	>
		<CurrentForm data={data.data} currentMatchday={data.currentMatchday} team={data.team.name} />
		<TableSnippet data={data.data} teamID={data.team.id} team={data.team.name} {switchTeam} />
	</div>
	<div class="flex-[10]">
		<NextGame data={data.data} team={data.team.name} {switchTeam} />
	</div>
</Row>
