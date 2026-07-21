<script lang="ts">
	import { toAlias, getTeamID } from '$lib/team';
	import type { Team } from '$lib/types';

	function switchTeamToTop(team: Team) {
		switchTeam(team);
		window.scrollTo(0, 0);
		toggleMobileNav();
	}

	function teamStyling(team: Team) {
		const teamID = getTeamID(team);
		return `color: var(--${teamID}-secondary);background-color: var(--${teamID});`;
	}

	export let teams: Team[],
		switchTeam: (newTeam: Team) => void,
		toggleMobileNav: () => void;
</script>

<nav
	id="mobileNav"
	class="fixed z-[2] hidden h-screen overflow-hidden animate-[appear_0.1s_ease-in]"
>
	<div class="flex h-full flex-col">
		{#each teams as team, i}
			{#if team != null}
				<button
					on:click={() => switchTeamToTop(team)}
					style={teamStyling(team)}
					class:first-team={i === 0 || (i === 1 && team[0] === null)}
					class:last-team={i === teams.length - 1 || (i === teams.length - 2 && teams[teams.length - 1] === null)}
					class="flex-1 cursor-pointer border-none bg-inherit p-[0.4em] text-[1em] text-inherit"
				>
					{toAlias(team)}
				</button>
			{/if}
		{/each}
	</div>
</nav>

<style scoped>
	@keyframes appear {
		from {
			width: 0%;
		}
		to {
			width: 100%;
		}
	}
</style>
