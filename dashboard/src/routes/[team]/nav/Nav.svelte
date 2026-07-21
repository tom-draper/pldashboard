<script lang="ts">
	import { teamColourVars, teamStyle } from '$lib/format';
	import { getTeamID, toAlias } from '$lib/team';
	import closeNavIcon from '$lib/images/arrow-bar-left.svg';
	import type { Team } from '$lib/types';

	function closeNavBar() {
		const navBar = document.getElementById('navBar');
		if (navBar !== null) {
			navBar.style.display = 'none';
		}
		const dashboard = document.getElementById('dashboard');
		if (dashboard != null) {
			dashboard.style.marginLeft = '0';
		}
		window.dispatchEvent(new Event('resize'));
	}

	const widths: number[] = Array.from({ length: 20 }, () => 35 + Math.floor(Math.random() * 8) * 5);

	export let team: null | Team, teams: Team[], switchTeam: (newTeam: Team) => void;
</script>

<nav id="navBar" class="fixed h-screen w-[220px] bg-[var(--purple)] max-xl:hidden">
	<div class="grid h-24 select-none place-items-center text-[1.6em] text-white">
		<a href="/home" class="text-white no-underline">
			<span class="text-[var(--green)]">pl</span>dashboard
		</a>
	</div>

	<div class="grid text-[1em] text-[var(--pink)]">
		{#if !teams}
			{#each widths as width}
				<div class="placeholder" style="width: {width}%"></div>
			{/each}
		{:else}
			{#each teams as _team (_team)}
				{#if _team === team}
					<a href="/{getTeamID(_team)}" class="team-link">
						<div class="this-team-container text-[var(--pink)]" style={teamStyle(_team)}>
							<div class="px-[1.4em] py-[0.4em] leading-[normal]">
								{toAlias(_team)}
							</div>
						</div>
					</a>
				{:else}
					<button
						class="team-link cursor-pointer border-none bg-transparent p-0 text-left font-inherit text-inherit outline-none"
						on:click={() => switchTeam(_team)}
					>
						<div
							class="team-container transition-[background-color,color] duration-250 ease-in-out"
							style={teamColourVars(_team)}
						>
							<div class="px-[1.4em] py-[0.4em] leading-[normal]">
								{toAlias(_team)}
							</div>
						</div>
					</button>
				{/if}
			{/each}
		{/if}
	</div>

	<div
		class="group absolute bottom-[3.75em] mx-[1.4em] mt-[0.4em] cursor-pointer text-[13px] text-white"
	>
		<a
			class="text-inherit no-underline group-hover:text-[var(--green)]"
			href="https://www.buymeacoffee.com/tomdraper"
		>
			Buy Me a Coffee
		</a>
	</div>

	<div
		class="group absolute bottom-[1em] mx-[1.4em] mb-[3px] mt-[0.4em] cursor-pointer text-[13px] text-white"
	>
		<a class="text-inherit no-underline group-hover:text-[var(--green)]" href="/fantasy">
			Play fantasy?
		</a>
	</div>

	<div>
		<button
			class="absolute right-[0.9em] bottom-[0.9em] mb-px cursor-pointer border-none bg-transparent pt-[0.3em] outline-none"
			on:click={closeNavBar}
		>
			<img src={closeNavIcon} alt="Close" class="h-[25px] w-[25px]" />
		</button>
	</div>
</nav>

<style scoped>
	@keyframes team-colour-reveal {
		0%,
		20% {
			background-color: #140921;
			color: var(--pink);
		}
		100% {
			background-color: var(--team-colour);
			color: var(--team-text);
		}
	}

	.team-link:hover .team-container {
		background-color: #140921;
		animation: team-colour-reveal 10s ease-in-out forwards;
	}

	@media (prefers-reduced-motion: reduce) {
		.team-link:hover .team-container {
			animation: none;
		}
	}

	.placeholder {
		height: 19px;
		margin: 6px 21px;
		background: #c600d8;
		border-radius: 4px;
		opacity: 0.25;
		position: relative;
		overflow: hidden;
	}

	.placeholder::before {
		content: '';
		position: absolute;
		left: -100px;
		top: 0;
		height: 100%;
		width: 150px;
		background: linear-gradient(to right, transparent 0%, #eea7f4 50%, transparent 100%);
		animation: load 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
	}

	@keyframes load {
		from {
			left: -100px;
		}
		to {
			left: 100px;
		}
	}
</style>
