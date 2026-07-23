<script lang="ts">
	import FantasyNav from './nav/FantasyNav.svelte';
	import FantasyMobileNav from './nav/FantasyMobileNav.svelte';
	import PointsVsPrice from './PointsVsPrice.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Table from './Table.svelte';
	import type { FantasyDashboardData, Page } from './fantasy.types';
	import { replaceState } from '$app/navigation';
	import { filterDataByPage, getTitle } from './data';
	import OptimalTeam from './OptimalTeam.svelte';
	import Seo from '$components/Seo.svelte';
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

	function switchPage(newPage: Page) {
		data.page = newPage;
		data.title = getTitle(newPage);

		data.pageData = filterDataByPage(data.data, newPage);

		const nextPage = getNextPage(newPage);
		replaceState(nextPage, {}); // Change current url without reloading
	}

	function getNextPage(page: Page) {
		if (page === 'all') {
			return '/fantasy';
		} else if (!window.location.href.endsWith('/')) {
			return '/fantasy/' + data.page;
		}
		return data.page;
	}

	const pages: Page[] = ['all', 'forward', 'midfielder', 'defender', 'goalkeeper'];

	let pageWidth: number;
	$: mobileView = pageWidth <= 700;

	onMount(() => {});

	export let data: FantasyDashboardData;
</script>

<Seo
	title={data.title}
	description="Fantasy Premier League stats: the optimal team, points vs price, and player form and value to guide your FPL picks."
/>

<svelte:window bind:innerWidth={pageWidth} />

<div id="team" class="flex overflow-x-hidden text-[15px]">
	<FantasyNav currentPage={data.page} {pages} {switchPage} />
	<FantasyMobileNav {pages} {switchPage} {toggleMobileNav} />
	{#if pages.length === 0}
		<!-- Navigation disabled while teams list are loading -->
		<button
			id="mobileNavBtn"
			class="fixed bottom-0 z-[1] mb-[-1px] w-full border-none bg-[var(--purple)] py-[0.8em] text-[1.1em] text-white min-[1200px]:hidden"
			style="cursor: default">Menu</button
		>
	{:else}
		<button
			id="mobileNavBtn"
			class="fixed bottom-0 z-[1] mb-[-1px] w-full cursor-pointer border-none bg-[var(--purple)] py-[0.8em] text-[1.1em] text-white min-[1200px]:hidden"
			on:click={toggleMobileNav}
		>
			Menu
		</button>
	{/if}

	<div id="dashboard" class="ml-[220px] w-[calc(100%-220px)] max-[1200px]:ml-0 max-[1200px]:w-full">
		<div>
			<PointsVsPrice data={data.pageData} page={data.page} {mobileView} />
		</div>

		{#if data.page === 'all'}
			<div>
				<OptimalTeam data={data.pageData} />
			</div>
		{/if}

		<div>
			<Table data={data.pageData} page={data.page} />
		</div>
		<Footer lastUpdated={null} dark={false} />
	</div>
</div>
