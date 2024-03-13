<script lang="ts">
	import FantasyNav from './nav/FantasyNav.svelte';
	import FantasyMobileNav from './nav/FantasyMobileNav.svelte';
	import PointsVsPrice from './PointsVsPrice.svelte';
	import Footer from '../Footer.svelte';
	import Table from './Table.svelte';
	import type { FantasyDashboardData, FantasyData, Page } from './fantasy.types';
	import { replaceState } from '$app/navigation';

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

	function filterDataByPage(data: FantasyData, page: Page) {
		const pageData: FantasyData = {};
		for (const team in data) {
			if (
				team === '_id' ||
				page === 'all' ||
				(page === 'attack' && data[team].position === 'Forward') ||
				(page === 'midfield' && data[team].position === 'Midfielder') ||
				(page === 'defence' && data[team].position === 'Defender') ||
				(page === 'goalkeeper' && data[team].position === 'Goalkeeper')
			)
				pageData[team] = data[team];
		}
		return pageData;
	}

	function switchPage(newPage: Page) {
		data.page = newPage;
		if (data.page === 'all') {
			data.title = 'Fantasy';
		} else {
			data.title = `Fantasy | ${data.page[0].toUpperCase() + data.page.slice(1)}`;
		}

		data.pageData = filterDataByPage(data.data, data.page);

		let nextPage: string = data.page;
		if (nextPage === 'all') {
			nextPage = '/fantasy';
		} else if (!window.location.href.endsWith('/')) {
			nextPage = '/fantasy/' + nextPage;
		}
		replaceState(nextPage, {}); // Change current url without reloading
	}

	const pages: Page[] = ['all', 'attack', 'midfield', 'defence', 'goalkeeper'];

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

		<div class="table">
			<Table data={data.pageData} page={data.page} />
		</div>
		<Footer lastUpdated={null} />
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
