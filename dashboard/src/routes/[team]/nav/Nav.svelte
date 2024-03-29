<script lang="ts">
	import { teamStyle } from '$lib/format';
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
		window.dispatchEvent(new Event('resize')); // Snap plotly graphs to new width
	}

	const widths: number[] = Array.from({ length: 20 }, () => 35 + Math.floor(Math.random() * 8) * 5);

	export let team: null | Team, teams: Team[], switchTeam: (newTeam: Team) => void;
</script>

<nav id="navBar">
	<div class="title no-selection">
		<a href="/home">
			<span style="color: var(--green)">pl</span>dashboard
		</a>
	</div>
	<div class="team-links">
		{#if !teams}
			{#if widths}
				{#each widths as width, _}
					<div class="placeholder" style="width: {width}%" />
				{/each}
			{/if}
		{:else}
			{#each teams as _team, _ (_team)}
				{#if _team === team}
					<a href="/{getTeamID(_team)}" class="team-link">
						<div class="this-team-container" style={teamStyle(_team)}>
							<div class="this-team-name">
								{toAlias(_team)}
							</div>
						</div>
					</a>
				{:else}
					<button
						class="team-link"
						on:click={() => {
							switchTeam(_team);
						}}
					>
						<div class="team-container">
							<div class="team-name">
								{toAlias(_team)}
							</div>
						</div>
					</button>
				{/if}
			{/each}
		{/if}
	</div>
	<div class="close">
		<button class="close-btn" on:click={closeNavBar}>
			<img src={closeNavIcon} alt="Close" />
		</button>
	</div>
</nav>

<style scoped>
	.title {
		color: white;
		font-size: 1.6em;
		height: 96px;
		display: grid;
		place-items: center;
	}
	.title a {
		color: white;
	}
	.no-selection {
		user-select: none;
		-webkit-user-select: none;
		-moz-user-select: none;
	}
	.team-links {
		font-size: 1em;
		color: var(--pink);
		display: grid;
	}
	button {
		background: none;
		color: inherit;
		border: none;
		padding: 0;
		font: inherit;
		cursor: pointer;
		outline: inherit;
		text-align: left;
	}
	.team-name,
	.this-team-name {
		padding: 0.4em 1.4em;
	}
	.overview {
		padding: 0.4em 1.4em;
	}
	.overview-selected {
		color: var(--purple) !important;
		background: var(--green) !important;
	}

	.divider {
		height: 15px;
		border-bottom: 1px solid rgba(198, 0, 216, 0.4);
		width: 85%;
		margin: auto;
		margin-bottom: 15px;
	}

	.this-team-container {
		color: var(--pink);
	}

	:hover.overview-container,
	:hover.team-container {
		background: #2c002f;
		background: #140921;
	}
	nav {
		position: fixed;
		width: 220px;
		height: 100vh;
		background: #37003c;
		background: var(--purple);
	}
	img {
		height: 25px;
		width: 25px;
	}
	.close-btn {
		position: absolute;
		right: 0.9em;
		bottom: 0.6em;
		background: transparent;
		border: none;
		outline: none;
		padding-top: 0.3em;
		cursor: pointer;
	}

	.placeholder {
		height: 19px;
		margin: 6px 21px;
		width: 40px;
		background: #c600d8;
		border-radius: 4px;
		opacity: 0.25;
		position: relative;
		overflow: hidden;
	}

	.placeholder::before {
		content: '';
		display: block;
		position: absolute;
		left: -100px;
		top: 0;
		height: 100%;
		width: 150px;
		background: linear-gradient(to right, transparent 0%, #e8e8e8 50%, transparent 100%);
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

	@media only screen and (max-width: 1200px) {
		#navBar {
			display: none;
		}
	}
</style>
