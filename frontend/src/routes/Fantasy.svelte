<script lang="ts">
  import { Router } from "svelte-routing";
  import { onMount } from "svelte";
  import FantasyNav from "../components/nav/FantasyNav.svelte";
  import FantasyMobileNav from "../components/nav/FantasyMobileNav.svelte";
  import PointsVsPrice from "../components/fantasy/PointsVsPrice.svelte";


  let pages = ["All", "Attack", "Midfield", "Defence", "Goalkeeper"]

  function toggleMobileNav() {
    let mobileNav = document.getElementById("mobileNav");
    if (mobileNav.style.width === "0%") {
      mobileNav.style.display = "block";
      mobileNav.style.width = "100%";
    } else {
      mobileNav.style.display = "none";
      mobileNav.style.width = "0%";
    }
  }

  async function initFantasy() {
    if (page === undefined) {
      page = pages[0].toLowerCase()
    }

    const response = await fetch("https://pldashboard-backend.vercel.app/api/fantasy");
    if (!response.ok) {
      return
    }
    let json = await response.json();

    data = json
    pageData = json
    console.log(data)

    window.dispatchEvent(new Event("resize"));  // Snap plots to currently set size
  }

  let title = "Fantasy"

  function switchPage(newPage: string) {
    page = newPage;
    console.log(newPage)
    if (page === "all") {
      title = "Fantasy"
    } else {
      title = `Fantasy | ${page[0].toUpperCase() + page.substring(1)}`;
    }

    let newData = {}
    for (let team of Object.keys(data)) {
      if (team === "_id" || page === "all" ||
        page === "attack" && data[team].position === "Forward" ||
        page === "midfield" && data[team].position === "Midfielder" ||
        page === "defence" && data[team].position === "Defender" ||
        page === "goalkeeper" && data[team].position === "Goalkeeper"
        )
        newData[team] = data[team]
    }
    pageData = newData

    let nextPage = page
    if (nextPage === "all") {
      nextPage = "/fantasy"
    } else if (!window.location.href.endsWith("/")) {
      nextPage = "/fantasy/" + nextPage
    }
    window.history.pushState(null, null, nextPage); // Change current url without reloading
  }

  let data;
  let pageData;
  onMount(() => {
    initFantasy()
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));  // Snap plots to currently set size
    }, 500)
  });

  let pageWidth: number;
  $: mobileView = pageWidth <= 700;

  export let page: string;
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content="Fantasy Premier League Statistics Dashboard" />
</svelte:head>

<svelte:window bind:innerWidth={pageWidth} />

<Router>
  <div id="team">
    <FantasyNav currentPage={page} {pages} {switchPage} />
    <FantasyMobileNav
      currentPage={page}
      {pages}
      {switchPage}
      {toggleMobileNav}
    />
    {#if pages.length === 0}
      <!-- Navigation disabled while teams list are loading -->
      <button id="mobileNavBtn" style="cursor: default">Select Team</button>
    {:else}
      <button id="mobileNavBtn" on:click={toggleMobileNav}>
        Select Team
      </button>
    {/if}

    <div id="dashboard">
      {#if pageData != undefined}
      <div class="first-graph">
        <PointsVsPrice data={pageData} {page} {mobileView} />
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
