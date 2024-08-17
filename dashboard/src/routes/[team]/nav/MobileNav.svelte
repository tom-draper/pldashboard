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
		return `color: var(--${teamID}-secondary);backgroundColor: var(--${teamID});`
	}

	export let teams: Team[], switchTeam: (newTeam: Team) => void, toggleMobileNav: () => void;
</script>

<nav id="mobileNav" style="width: 0%;">
	<div class="team-links">
		{#each teams as team, i}
			{#if team != null}
				<button
					on:click={() => {
						switchTeamToTop(team);
					}}
					style="{teamStyling(team)}"
					class:first-team={i === 0 || (i === 1 && team[0] === null)}
					class:last-team={i === teams.length - 1 || (i === teams.length - 2 && teams[teams.length - 1] === null)}
					class="team-link">{toAlias(team)}</button
				>
			{/if}
		{/each}
	</div>
</nav>

<style scoped>
	#mobileNav {
		position: fixed;
		z-index: 2;
		overflow: hidden;
		height: 100vh;
		animation: appear 0.1s ease-in 1;
		display: none;
	}
	.team-links {
		display: flex;
		flex-direction: column;
		height: 100%;
	}
	.team-link {
		color: inherit;
		background: inherit;
		cursor: pointer;
		border: none;
		font-size: 1em;
		padding: 0.4em;
		flex: 1;
	}
	@keyframes appear {
		from {
			width: 0%;
		}
		to {
			width: 100%;
		}
	}
</style>
