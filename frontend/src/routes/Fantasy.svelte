<script lang="ts">
  import { Router } from 'svelte-routing';
  import { onMount } from 'svelte';
  import FantasyNav from '../components/nav/FantasyNav.svelte';
  import FantasyMobileNav from '../components/nav/FantasyMobileNav.svelte';
  import PointsVsPrice from '../components/fantasy/PointsVsPrice.svelte';
  import Footer from '../components/Footer.svelte';
  import Table from '../components/fantasy/Table.svelte';
  import { url } from '../lib/consts';
  import type { FantasyData, Page } from '../lib/fantasy.types';

  function toggleMobileNav() {
    const mobileNav = document.getElementById('mobileNav');
    if (mobileNav.style.width === '0%') {
      mobileNav.style.display = 'block';
      mobileNav.style.width = '100%';
    } else {
      mobileNav.style.display = 'none';
      mobileNav.style.width = '0%';
    }
  }

  async function initFantasy() {
    if (page === undefined) {
      page = pages[0];
    }

    const response = await fetch(`${url}/fantasy`);
    if (!response.ok) {
      return;
    }
    const json = await response.json();

    data = json;
    pageData = filterDataByPosition(data);
    console.log(data);
  }

  function filterDataByPosition(data: FantasyData) {
    const newData = {};
    for (const team of Object.keys(data)) {
      if (
        team === '_id' ||
        page === 'all' ||
        (page === 'attack' && data[team].position === 'Forward') ||
        (page === 'midfield' && data[team].position === 'Midfielder') ||
        (page === 'defence' && data[team].position === 'Defender') ||
        (page === 'goalkeeper' && data[team].position === 'Goalkeeper')
      )
        newData[team] = data[team];
    }
    return newData;
  }
  function switchPage(newPage: Page) {
    page = newPage;
    if (page === 'all') {
      title = 'Fantasy';
    } else {
      title = `Fantasy | ${page[0].toUpperCase() + page.slice(1)}`;
    }

    pageData = filterDataByPosition(data);

    let nextPage: string = page;
    if (nextPage === 'all') {
      nextPage = '/fantasy';
    } else if (!window.location.href.endsWith('/')) {
      nextPage = '/fantasy/' + nextPage;
    }
    window.history.pushState(null, null, nextPage); // Change current url without reloading
  }

  const pages: Page[] = ['all', 'attack', 'midfield', 'defence', 'goalkeeper'];
  let title = 'Fantasy';
  let data: FantasyData;
  let pageData: FantasyData;
  onMount(() => {
    initFantasy();
    setTimeout(() => {
      window.dispatchEvent(new Event('resize')); // Snap plots to currently set size
    }, 1000);
  });

  let pageWidth: number;
  $: mobileView = pageWidth <= 700;

  export let page: Page;
</script>

<svelte:head>
  <title>{title}</title>
  <meta
    name="description"
    content="Fantasy Premier League Statistics Dashboard"
  />
</svelte:head>

<svelte:window bind:innerWidth={pageWidth} />

<Router>
  <div id="team">
    <FantasyNav currentPage={page} {pages} {switchPage} />
    <FantasyMobileNav
      {pages}
      {switchPage}
      {toggleMobileNav}
    />
    {#if pages.length === 0}
      <!-- Navigation disabled while teams list are loading -->
      <button id="mobileNavBtn" style="cursor: default">Menu</button>
    {:else}
      <button id="mobileNavBtn" on:click={toggleMobileNav}> Menu </button>
    {/if}

    <div id="dashboard">
      {#if pageData != undefined}
        <div class="first-graph">
          <PointsVsPrice data={pageData} {page} {mobileView} />
        </div>

        <div class="table">
          <Table data={pageData} {page} {mobileView} />
        </div>
        <Footer lastUpdated={null} />
      {:else}
        <div class="loading-spinner-container">
          <div class="loading-spinner" />
        </div>
      {/if}
    </div>
  </div>
</Router>

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
