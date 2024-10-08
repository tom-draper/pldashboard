<script lang="ts">
	import FormTiles from './FormTiles.svelte';
	import { toInitials } from '$lib/team';
	import type { TeamsData } from '../dashboard.types';
	import type { Team } from '$lib/types';

	function getSortedMatchdays(data: TeamsData, team: Team): string[] {
		if (!(data._id in data.form[team])) {
			return [];
		}
		const matchdays = Object.keys(data.form[team][data._id]).sort(function (matchday1, matchday2) {
			return (
				new Date(data.form[team][data._id][matchday1].date).getTime() -
				new Date(data.form[team][data._id][matchday2].date).getTime()
			);
		});
		return matchdays;
	}

	function getFormStarTeams(data: TeamsData, team: Team, matchdays: string[]): boolean[] {
		const formStarTeams = [];
		for (const matchday of matchdays) {
			const opposition = data.form[team][data._id][matchday].team;
			const starTeam = opposition == null ? false : data.teamRatings[opposition].total > 0.75;
			formStarTeams.unshift(starTeam);
		}

		// Fill in blanks
		for (let i = formStarTeams.length; i < 5; i++) {
			formStarTeams.unshift(false);
		}

		return formStarTeams;
	}

	function getFormIcons(data: TeamsData, team: Team): string {
		if (!(data._id in data.form[team])) {
			return '';
		}

		let formIcons: string[] = [];
		const form = data.form[team][data._id][currentMatchday].form5;
		if (
			Object.keys(data.form[team][data._id][currentMatchday]).length > 0 &&
			form != null
		) {
			formIcons = form.split('');
		}

		// Fill in blanks with None icons
		for (let i = formIcons.length; i < 5; i++) {
			formIcons.unshift('N');
		}
		return formIcons.join('');
	}

	function getFormInitials(data: TeamsData, team: Team, matchdays: string[]): string[] {
		const formInitials = [];

		for (const matchday of matchdays) {
			const opposition =  data.form[team][data._id][matchday].team;
			const initials = opposition == null ? '' : toInitials(opposition);
			formInitials.unshift(initials);
		}

		// Fill in blanks with None icons
		for (let i = formInitials.length; i < 5; i++) {
			formInitials.unshift('');
		}

		return formInitials;
	}

	function latestNPlayedMatchdays(
		data: TeamsData,
		team: Team,
		matchdays: string[],
		N: number
	): string[] {
		const latestN = [];

		for (let i = matchdays.length - 1; i >= 0; i--) {
			if (data.form[team][data._id][matchdays[i]].score != null) {
				latestN.push(matchdays[i]);
			}
			if (latestN.length >= N) {
				break;
			}
		}

		return latestN;
	}

	function setFormValues() {
		const sortedMatchdays = getSortedMatchdays(data, team);

		const matchdays = latestNPlayedMatchdays(data, team, sortedMatchdays, 5);

		formIcons = getFormIcons(data, team);
		formStarTeams = getFormStarTeams(data, team, matchdays);
		formInitials = getFormInitials(data, team, matchdays);
	}

	function formPercentage(data: TeamsData, team: Team) {
		if (!(data._id in data.form[team])) {
			return 'N/A';
		}
		return ((data.form[team][data._id][currentMatchday].formRating5 ?? 0) * 100).toFixed(1) + '%'
	}

	let formIcons: string, formStarTeams: boolean[], formInitials: string[];
	$: team && setFormValues();

	export let data: TeamsData, currentMatchday: string, team: Team;
</script>

{#if formInitials != undefined}
	<div class="current-form-row icon-row">
		<FormTiles form="{formIcons}," starTeams={formStarTeams} />
	</div>
	<div class="current-form-row name-row">
		<div class="icon-name pos-0">{formInitials[0]}</div>
		<div class="icon-name pos-1">{formInitials[1]}</div>
		<div class="icon-name pos-2">{formInitials[2]}</div>
		<div class="icon-name pos-3">{formInitials[3]}</div>
		<div class="icon-name pos-4">{formInitials[4]}</div>
	</div>
{/if}
<div class="current-form">
	Current form:
	{#if currentMatchday != undefined}
		<span class="current-form-value"
			>{formPercentage(data, team)}</span
		>
	{:else}
		None
	{/if}
</div>

<style scoped>
	.current-form {
		font-size: 1.7rem;
		margin: 20px 0;
		width: 100%;
		padding: 9px 0;
		background: var(--purple);
		color: white;
		border-radius: var(--border-radius);
	}
	.current-form-row {
		font-size: 13px;
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		width: 100%;
	}
	.current-form-value {
		color: var(--win);
	}

	.icon-name {
		position: relative;
		margin-top: 0.6em;
	}

	.pos-4 {
		opacity: 100%;
	}
	.pos-3 {
		opacity: 89%;
	}
	.pos-2 {
		opacity: 78%;
	}
	.pos-1 {
		opacity: 67%;
	}
	.pos-0 {
		opacity: 56%;
	}

	@media only screen and (max-width: 1000px) {
		.current-form-row {
			width: min(80%, 440px);
			margin: auto;
		}
	}

	@media only screen and (max-width: 700px) {
		.current-form-row {
			width: 95%;
		}
	}
	@media only screen and (max-width: 550px) {
		.current-form {
			font-size: 1.5rem !important;
		}
	}
</style>
