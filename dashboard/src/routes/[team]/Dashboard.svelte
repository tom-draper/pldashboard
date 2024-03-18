<script lang="ts">
	import Footer from '../Footer.svelte';
	import Nav from './nav/Nav.svelte';
	import MobileNav from './nav/MobileNav.svelte';
	import { getCurrentMatchday, getTeamID, playedMatchdayDates, toAlias } from './team';
	import type { Team, DashboardData } from './dashboard.types';
	import { replaceState } from '$app/navigation';
	import { slugAlias, toTitleCase } from './format';
	import TeamsContent from './TeamsContent.svelte';
	import OverviewContent from './OverviewContent.svelte';
	import { onMount } from 'svelte';

	function toggleMobileNav() {
		const mobileNav = document.getElementById('mobileNav');
		if (mobileNav === null) {
			return;
		}

		if (mobileNav.style.width === '0%') {
			mobileNav.style.display = 'block';
			mobileNav.style.width = '100%';
		} else {
			mobileNav.style.display = 'none';
			mobileNav.style.width = '0%';
		}
	}

	function switchTeam(newTeam: Team) {
		data.slug = slugAlias(getTeamID(newTeam));
		data.team.id = data.slug;
		data.team.name = toTitleCase(data.slug.replace(/-/g, ' ')) as Team;
		data.title = `Dashboard | ${data.team.name}`;
		// Overwrite values from new team's perspective using same data
		data.currentMatchday = getCurrentMatchday(data.data, data.team.name);
		data.playedDates = playedMatchdayDates(data.data, data.team.name);

		replaceState(data.slug, {}); // Change current url without reloading
	}

	onMount(() => {
		console.log(data.data);
	});

	export let data: DashboardData;
</script>

<svelte:head>
	<title>{data.title}</title>
</svelte:head>

<div id="team">
	<Nav team={data.team.name} teams={data.teams} {switchTeam} />
	<MobileNav teams={data.teams} {switchTeam} {toggleMobileNav} />
	<button id="mobileNavBtn" on:click={toggleMobileNav}> Select Team </button>

	<div id="dashboard">
		{#if data.slug === 'overview'}
			<div class="header overview-header">
				<a class="main-link no-decoration" href="/overview">
					<div class="title">Overview</div>
				</a>
			</div>
		{:else}
			<div class="header" style="background-color: var(--{data.team.id});">
				<a class="main-link no-decoration" href="/{data.team.id}">
					<div class="title" style="color: var(--{data.team.id + '-secondary'});">
						{toAlias(data.team.name)}
					</div>
				</a>
			</div>
		{/if}

		{#if data.slug === 'overview'}
			<OverviewContent {data} />
		{:else}
			<TeamsContent {data} {switchTeam} />
		{/if}
		<Footer lastUpdated={data.data.lastUpdated} dark={false} />
	</div>
</div>

<style scoped>
	.header {
		display: grid;
		place-items: center;
	}
	.overview-header {
		background-color: var(--green);
		color: var(--purple);
	}
	.main-link {
		width: fit-content;
		display: grid;
		place-items: center;
	}
	.title {
		font-size: 2.3rem;
		width: fit-content;
	}

	.default-cursor {
		cursor: default;
	}

	#team {
		display: flex;
		overflow-x: hidden;
		font-size: 15px;
	}

	#dashboard {
		margin-left: 220px;
		width: 100%;
	}

	#mobileNavBtn {
		position: fixed;
		color: white;
		background: var(--purple);
		padding: 0.8em 0;
		cursor: pointer;
		font-size: 1.1em;
		z-index: 100;
		width: 100%;
		bottom: 0;
		border: none;
		margin-bottom: -1px; /* For gap at bottom found in safari */
	}

	@media only screen and (min-width: 1200px) {
		#mobileNavBtn {
			display: none;
		}
	}

	@media only screen and (max-width: 1200px) {
		#dashboard {
			margin-left: 0;
		}
	}
</style>
