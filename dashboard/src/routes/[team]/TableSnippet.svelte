<script lang="ts">
	import type { TeamsData } from './dashboard.types';
	import { getTeams, toAlias } from '$lib/team';
	import type { Team } from '$lib/types';

	function tableSnippetRange(sortedTeams: Team[], team: Team): [number, number] {
		const teamStandingsIdx = sortedTeams.indexOf(team);

		let low = teamStandingsIdx - 3;
		let high = teamStandingsIdx + 4;
		if (low < 0) {
			const overflow = low;
			high -= overflow;
			low = 0;
		}
		if (high > sortedTeams.length - 1) {
			const overflow = high - sortedTeams.length;
			low -= overflow;
			high = sortedTeams.length;
		}

		return [low, high];
	}

	function buildTableSnippet() {
		const sortedTeams = getTeams(data).sort(function (teamA, teamB) {
			return data.standings[teamA][data._id].position - data.standings[teamB][data._id].position;
		});

		const [low, high] = tableSnippetRange(sortedTeams, team);

		let teamTableIdx: number | null = null;
		const rows = [];
		for (let i = low; i < high; i++) {
			if (sortedTeams[i] === team) {
				teamTableIdx = i - low;
			}
			rows.push({
				name: sortedTeams[i],
				position: data.standings[sortedTeams[i]][data._id].position,
				points: data.standings[sortedTeams[i]][data._id].points,
				gd: data.standings[sortedTeams[i]][data._id].gD
			});
		}

		if (teamTableIdx !== null) {
			tableSnippet = {
				teamTableIdx: teamTableIdx,
				rows: rows
			};
		}
	}

	type TableSnippet = {
		teamTableIdx: number;
		rows: {
			name: Team;
			position: number;
			points: number;
			gd: number;
		}[];
	};

	let tableSnippet: TableSnippet;
	$: team && buildTableSnippet();

	export let data: TeamsData, teamID: string, team: Team, switchTeam: (newTeam: Team) => void;

	const rowClass = 'flex rounded-[var(--border-radius)] px-[5%] py-[5px]';
	const thisTeamRowClass = 'flex rounded-[var(--border-radius)] px-[5%] py-[14px] text-[1.1em]';
	const dividerClass = 'm-auto w-[90%] self-center border-b border-b-[grey]';
</script>

<div
	class="relative mt-[20px] flex h-auto w-full flex-col max-[1100px]:mt-0 max-[550px]:text-[14px]"
>
	{#if tableSnippet != undefined}
		<div></div>
		<div class={rowClass}>
			<div class="w-[7%] font-bold"></div>
			<div class="ml-[8px] w-[63%] text-left font-bold text-[#333333]">Team</div>
			<div class="w-[15%] font-bold">GD</div>
			<div class="w-[15%] font-bold">Points</div>
		</div>

		{#each tableSnippet.rows as row, i}
			<!-- Divider -->
			{#if i === 0}
				{#if i != tableSnippet.teamTableIdx}
					<div class={dividerClass}></div>
				{/if}
			{:else if i - 1 != tableSnippet.teamTableIdx && i != tableSnippet.teamTableIdx}
				<div class={dividerClass}></div>
			{/if}
			<!-- Row of table -->
			{#if i === tableSnippet.teamTableIdx}
				<!-- Highlighted row for the team of the current page -->
				<div class={thisTeamRowClass} style="background-color: var(--{teamID});">
					<div class="w-[7%] text-[1.1em]" style="color: var(--{teamID}-secondary);">
						{row.position}
					</div>
					<a
						href="/{teamID}"
						class="ml-[8px] w-[63%] text-left text-[1.1em]"
						style="color: var(--{teamID}-secondary);"
					>
						{toAlias(row.name)}
					</a>
					<div class="w-[15%] text-[1.1em]" style="color: var(--{teamID}-secondary);">
						{row.gd}
					</div>
					<div class="w-[15%] text-[1.1em]" style="color: var(--{teamID}-secondary);">
						{row.points}
					</div>
				</div>
			{:else}
				<!-- Plain row -->
				<div class={rowClass}>
					<div class="w-[7%]">
						{row.position}
					</div>
					<button
						on:click={() => {
							switchTeam(row.name);
						}}
						class="ml-[8px] w-[63%] cursor-pointer border-none bg-transparent p-0 text-left text-[#333333] [font:inherit] [outline:inherit]"
					>
						{toAlias(row.name)}
					</button>
					<div class="w-[15%]">
						{row.gd}
					</div>
					<div class="w-[15%]">
						{row.points}
					</div>
				</div>
			{/if}
		{/each}
		{#if tableSnippet.teamTableIdx != 6}
			<div class={dividerClass}></div>
		{/if}
	{/if}
</div>
