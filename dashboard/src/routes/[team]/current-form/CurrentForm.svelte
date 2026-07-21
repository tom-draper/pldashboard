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
		if (Object.keys(data.form[team][data._id][currentMatchday]).length > 0 && form != null) {
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
			const opposition = data.form[team][data._id][matchday].team;
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
		return ((data.form[team][data._id][currentMatchday].formRating5 ?? 0) * 100).toFixed(1) + '%';
	}

	let formIcons: string, formStarTeams: boolean[], formInitials: string[];
	$: team && setFormValues();

	export let data: TeamsData, currentMatchday: string, team: Team;

	const rowClass =
		'grid w-full grid-cols-5 text-[13px] max-[1000px]:m-auto max-[1000px]:w-[min(80%,440px)] max-[700px]:w-[95%]';
</script>

{#if formInitials != undefined}
	<div class={rowClass}>
		<FormTiles form="{formIcons}," starTeams={formStarTeams} />
	</div>
	<div class={rowClass}>
		<div class="relative mt-[0.6em] opacity-[0.56]">{formInitials[0]}</div>
		<div class="relative mt-[0.6em] opacity-[0.67]">{formInitials[1]}</div>
		<div class="relative mt-[0.6em] opacity-[0.78]">{formInitials[2]}</div>
		<div class="relative mt-[0.6em] opacity-[0.89]">{formInitials[3]}</div>
		<div class="relative mt-[0.6em] opacity-100">{formInitials[4]}</div>
	</div>
{/if}
<div
	class="my-[20px] w-full rounded-[var(--border-radius)] bg-[var(--purple)] py-[9px] text-[1.7rem] text-white max-[550px]:text-[1.5rem]"
>
	Current form:
	{#if currentMatchday != undefined}
		<span class="text-[var(--win)]">{formPercentage(data, team)}</span>
	{:else}
		None
	{/if}
</div>
