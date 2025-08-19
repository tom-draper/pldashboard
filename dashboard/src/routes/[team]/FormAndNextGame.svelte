<script lang="ts">
	import CurrentForm from './current-form/CurrentForm.svelte';
	import TableSnippet from './TableSnippet.svelte';
	import NextGame from './NextGame.svelte';
	import type { DashboardData } from './dashboard.types';
	import type { Team } from '$lib/types';

	export let data: DashboardData, switchTeam: (newTeam: Team) => void;
</script>

<div class="row multi-element-row">
	<div class="row-left form-details">
		<CurrentForm data={data.data} currentMatchday={data.currentMatchday} team={data.team.name} />
		<TableSnippet data={data.data} teamID={data.team.id} team={data.team.name} {switchTeam} />
	</div>
	<div class="row-right">
		<NextGame data={data.data} team={data.team.name} {switchTeam} />
	</div>
</div>

<style>
	.row {
		position: relative;
		display: flex;
		margin-bottom: 3rem;
		height: auto;
	}

	.row-left {
		display: flex;
		flex-direction: column;
		padding-right: auto;
		margin-right: 1.5em;
		text-justify: center;
		flex: 4;
	}
	.row-right {
		flex: 10;
	}
	.multi-element-row {
		margin: 0 1.4em 3rem;
	}

	@media only screen and (min-width: 1100px) {
		.form-details {
			width: 80%;
			align-items: center;
		}
	}

	@media only screen and (max-width: 1000px) {
		.row {
			flex-direction: column;
			margin-bottom: 40px;
		}

		.multi-element-row {
			margin: 0;
		}
		.row-left {
			margin-right: 0;
			align-self: center;
			width: 80%;
		}
	}

	@media only screen and (max-width: 550px) {
		.multi-element-row {
			margin: 0;
		}

		.form-details {
			width: 95%;
		}
	}
</style>