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

	// One column template for every row, so the header, the highlighted row and
	// the plain rows cannot drift out of alignment.
	//
	// These were previously four percentage widths repeated on each row's cells,
	// and they summed to 7 + 63 + 15 + 15 = 100% *plus* an 8px margin on the
	// name. Every row therefore overflowed by 8px, and flex resolved that by
	// shrinking the cells. A flex item will not shrink below its min-content
	// width, which differs per row (the header is bold, the highlighted row is
	// 1.1em, the plain rows are neither), so each row shrank by a different
	// amount and the columns landed in different places.
	//
	// Grid tracks are sized from the template rather than the content, so the
	// four columns are identical on every row whatever it contains. The name's
	// 8px indent is padding now, inside its own track rather than added to the
	// row's total width.
	const gridCols = 'grid grid-cols-[7%_63%_15%_15%]';
	const rowClass = `${gridCols} rounded-[var(--border-radius)] px-[5%] py-[5px]`;
	// 1.21em, not 1.1em: text-[1.1em] used to sit on this row *and* on each of
	// its cells, and em compounds, so the highlighted row has always rendered at
	// 1.1 x 1.1. The cells no longer carry their own size, so the product is
	// stated here to keep the row exactly the size it has always been.
	const thisTeamRowClass = `${gridCols} rounded-[var(--border-radius)] px-[5%] py-[14px] text-[1.21em]`;
	const dividerClass = 'm-auto w-[90%] self-center border-b border-b-[grey]';
	// min-w-0 stops a long name widening its own track and pushing the numbers
	// out of line, which is the same failure the percentages had.
	const nameCellClass = 'min-w-0 pl-[8px] text-left';

	// Hovering a row darkens its text instead of filling it with a background.
	//
	// The colour sits on the button rather than the cells so all four inherit
	// it and shift together: hovering the position number lights the row up as
	// one thing, which is what it is.
	//
	// Weight and size are deliberately untouched. The columns are fixed tracks,
	// so bolding a long name like Wolverhampton Wanderers could wrap it inside
	// its track and change the row's height under the cursor.
	//
	// focus-visible mirrors hover so a row reached by keyboard reads the same;
	// the button clears its own outline via [outline:inherit].
	const plainRowClass =
		`${rowClass} w-full cursor-pointer border-none bg-transparent text-left ` +
		'text-[#333333] [font:inherit] [outline:inherit] ' +
		'hover:text-[var(--dark-purple)] focus-visible:text-[var(--dark-purple)]';
</script>

<div
	class="relative mt-[20px] flex h-auto w-full flex-col max-[1100px]:mt-0 max-[550px]:text-[14px]"
>
	{#if tableSnippet != undefined}
		<div></div>
		<div class={rowClass}>
			<div class="font-bold"></div>
			<div class="{nameCellClass} font-bold text-[#333333]">Team</div>
			<div class="font-bold">GD</div>
			<div class="font-bold">Points</div>
		</div>

		{#each tableSnippet.rows as row, i (row.name)}
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
					<div style="color: var(--{teamID}-secondary);">
						{row.position}
					</div>
					<a href="/{teamID}" class={nameCellClass} style="color: var(--{teamID}-secondary);">
						{toAlias(row.name)}
					</a>
					<div style="color: var(--{teamID}-secondary);">
						{row.gd}
					</div>
					<div style="color: var(--{teamID}-secondary);">
						{row.points}
					</div>
				</div>
			{:else}
				<!-- Plain row: the whole row is the switch-team control so it reads as clickable. -->
				<button
					type="button"
					on:click={() => {
						switchTeam(row.name);
					}}
					class={plainRowClass}
				>
					<span>
						{row.position}
					</span>
					<span class={nameCellClass}>
						{toAlias(row.name)}
					</span>
					<span>
						{row.gd}
					</span>
					<span>
						{row.points}
					</span>
				</button>
			{/if}
		{/each}
		{#if tableSnippet.teamTableIdx != 6}
			<div class={dividerClass}></div>
		{/if}
	{/if}
</div>
