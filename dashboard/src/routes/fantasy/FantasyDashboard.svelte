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

	export let data: FantasyDashboardData;
</script>

<svelte:head>
	<title>{data.title}</title>
	<meta name="description" content="Fantasy Premier League Statistics Dashboard" />
</svelte:head>

<svelte:window bind:innerWidth={pageWidth} />

<div id="team">
	<FantasyNav currentPage={data.page} {pages} {switchPage} />
	<FantasyMobileNav {pages} {switchPage} {toggleMobileNav} />
	{#if pages.length === 0}
		<!-- Navigation disabled while teams list are loading -->
		<button id="mobileNavBtn" style="cursor: default">Menu</button>
	{:else}
		<button id="mobileNavBtn" on:click={toggleMobileNav}> Menu </button>
	{/if}

	<div id="dashboard">
		<div class="first-graph">
			<PointsVsPrice data={data.pageData} page={data.page} {mobileView} />
		</div>

		{#if data.page === 'all'}
			<div>
				<OptimalTeam data={data.pageData} />
			</div>
		{/if}

		<div class="table">
			<Table data={data.pageData} page={data.page} />
		</div>
		<Footer lastUpdated={null} dark={false} />
	</div>
</div>

<style scoped>
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
		z-index: 1;
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
