<script lang="ts">
	import { onMount } from 'svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { browser } from '$app/environment';
	import Nav from './nav/Nav.svelte';
	import MobileNav from './nav/MobileNav.svelte';
	import { getCurrentMatchday, getTeamID, playedMatchdayDates, toAlias } from '$lib/team';
	import type { DashboardData } from './dashboard.types';
	import { replaceState } from '$app/navigation';
	import { slugAlias } from '$lib/format';
	import TeamsContent from './TeamsContent.svelte';
	import OverviewContent from './OverviewContent.svelte';
	import Seo from '$components/Seo.svelte';
	import type { Team } from '$lib/types';
	import { setThemeColor } from '$lib/theme';

	const { data }: { data: DashboardData } = $props();
	let selectedTeam = $state<Team>();

	const viewData = $derived.by((): DashboardData => {
		const team = selectedTeam ?? data.team.name;
		const slug = slugAlias(getTeamID(team));
		return {
			...data,
			slug,
			team: { name: team, id: slug },
			title: `Dashboard - ${team}`,
			currentMatchday: getCurrentMatchday(data.data, team),
			playedDates: playedMatchdayDates(data.data, team)
		};
	});

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

	function switchTeam(newTeam: Team) {
		if (!browser) {
			return;
		}

		const newSlug = slugAlias(getTeamID(newTeam));
		if (viewData.slug !== newSlug) {
			selectedTeam = newTeam;
			replaceState(`/${newSlug}`, {});
			setThemeColor(getCSSVar(`--${newSlug}`));
		}
	}

	onMount(() => {
		setThemeColor(getCSSVar(`--${data.team.id}`));
	});
</script>

{#if viewData.slug === 'overview'}
	<Seo
		title="Dashboard - Overview"
		description="Premier League standings, upcoming fixtures and team ratings at a glance, updated through the season."
		path="/overview"
	/>
{:else}
	<Seo
		title={viewData.title}
		description="{viewData.team
			.name} Premier League statistics: current form, league position, goals scored and conceded, upcoming fixtures and match predictions."
		path="/{viewData.team.id}"
	/>
{/if}

<div id="team" class="flex overflow-x-hidden text-[15px]">
	<Nav team={viewData.team.name} teams={viewData.teams} {switchTeam} />
	<MobileNav teams={viewData.teams} {switchTeam} {toggleMobileNav} />

	<button
		id="mobileNavBtn"
		class="fixed bottom-0 z-[100] mb-[-1px] w-full cursor-pointer border-none bg-[var(--purple)] py-[0.8em] text-[1.1em] text-white xl:hidden"
		onclick={toggleMobileNav}
	>
		Select Team
	</button>

	<div id="dashboard" class="ml-0 w-full xl:ml-[220px]">
		{#if viewData.slug === 'overview'}
			<div class="grid h-24 place-items-center bg-[var(--green)] text-[var(--purple)]">
				<a class="main-link no-decoration grid w-fit place-items-center" href="/overview">
					<div class="w-fit text-[2.3rem]">Overview</div>
				</a>
			</div>
		{:else}
			<div class="grid h-24 place-items-center" style="background-color: var(--{viewData.team.id});">
				<a class="main-link no-decoration grid w-fit place-items-center" href="/{viewData.team.id}">
					<div class="w-fit text-[2.3rem]" style="color: var(--{viewData.team.id + '-secondary'});">
						{toAlias(viewData.team.name)}
					</div>
				</a>
			</div>
		{/if}

		{#if viewData.slug === 'overview'}
			<OverviewContent data={viewData} />
		{:else}
			<TeamsContent data={viewData} {switchTeam} />
		{/if}

		<Footer lastUpdated={viewData.data.lastUpdated} dark={false} />
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
