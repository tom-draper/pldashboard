<script lang="ts">
	import { onMount } from 'svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { browser } from '$app/environment';
	import Nav from './nav/Nav.svelte';
	import MobileNav from './nav/MobileNav.svelte';
	import { getCurrentMatchday, getTeamID, playedMatchdayDates, toAlias } from '$lib/team';
	import type { DashboardData } from './dashboard.types';
	import { replaceState } from '$app/navigation';
	import { slugAlias, toTitleCase } from '$lib/format';
	import TeamsContent from './TeamsContent.svelte';
	import OverviewContent from './OverviewContent.svelte';
	import type { Team } from '$lib/types';
	import { setThemeColor } from '$lib/theme';

	function toggleMobileNav() {
		const mobileNav = document.getElementById('mobileNav');
		const mobileNavBtn = document.getElementById('mobileNavBtn');
		if (mobileNav === null || mobileNavBtn === null) {
			return;
		}

		if (mobileNav.style.width === '0%') {
			mobileNav.style.display = 'block';
			mobileNav.style.width = '100%';
			mobileNavBtn.style.display = 'none';
		} else {
			mobileNav.style.display = 'none';
			mobileNav.style.width = '0%';
			mobileNavBtn.style.display = 'unset';
		}
	}

	function getCSSVar(name: string) {
		return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	}

	async function switchTeam(newTeam: Team) {
		if (!browser) {
			return;
		}

		const newSlug = slugAlias(getTeamID(newTeam));
		if (data.slug !== newSlug) {
			data.slug = newSlug;
			data.team.id = data.slug;
			data.team.name = toTitleCase(data.slug.replace(/-/g, ' ')) as Team;
			data.title = `Dashboard | ${data.team.name}`;
			// Overwrite values from new team's perspective using same data
			data.currentMatchday = getCurrentMatchday(data.data, data.team.name);
			data.playedDates = playedMatchdayDates(data.data, data.team.name);

			try {
				replaceState(data.slug, {}); // Change current url without reloading
			} catch (error) {
				console.warn('SvelteKit navigation failed, using native browser API:', error);
				// Fallback to native browser navigation
				window.history.replaceState({}, '', `/${data.slug}`);
			}

			// Set theme after navigation
			setThemeColor(getCSSVar(`--${data.team.id}`));
		}
	}

	let routerReady = false;

	onMount(() => {
		console.log(data.data);
		setThemeColor(getCSSVar(`--${data.team.id}`));
		// Mark router as ready after mount
		routerReady = true;
	});

	export let data: DashboardData;
</script>

<svelte:head>
	<title>{data.title}</title>
</svelte:head>

<div id="team" class="flex overflow-x-hidden text-[15px]">
	<Nav team={data.team.name} teams={data.teams} {switchTeam} />
	<MobileNav teams={data.teams} {switchTeam} {toggleMobileNav} />

	<button
		id="mobileNavBtn"
		class="fixed bottom-0 z-[100] mb-[-1px] w-full cursor-pointer border-none bg-[var(--purple)] py-[0.8em] text-[1.1em] text-white xl:hidden"
		on:click={toggleMobileNav}
	>
		Select Team
	</button>

	<div id="dashboard" class="ml-0 w-full xl:ml-[220px]">
		{#if data.slug === 'overview'}
			<div class="grid h-24 place-items-center bg-[var(--green)] text-[var(--purple)]">
				<a class="main-link no-decoration grid w-fit place-items-center" href="/overview">
					<div class="w-fit text-[2.3rem]">Overview</div>
				</a>
			</div>
		{:else}
			<div class="grid h-24 place-items-center" style="background-color: var(--{data.team.id});">
				<a class="main-link no-decoration grid w-fit place-items-center" href="/{data.team.id}">
					<div class="w-fit text-[2.3rem]" style="color: var(--{data.team.id + '-secondary'});">
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
	/* Dynamic CSS variable names can't be expressed with Tailwind, so these remain inline. */

	/* Remove these if they're already defined globally. */
	.main-link {
		text-decoration: none;
	}

	.no-decoration {
		text-decoration: none;
	}
</style>
