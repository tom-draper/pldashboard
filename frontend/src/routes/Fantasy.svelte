<script lang="ts">
  import { Router } from "svelte-routing";
  import { onMount } from "svelte";
  import Nav from "../components/nav/Nav.svelte";
  import MobileNav from "../components/nav/MobileNav.svelte";

  import { toAlias } from "../lib/team";

  function toggleMobileNav() {
    let mobileNav = document.getElementById("mobileNav");
    if (mobileNav.style.width === "0px") {
      mobileNav.style.width = "100%";
    } else {
      mobileNav.style.width = "0px";
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

    console.log(json)
    data = json

    window.dispatchEvent(new Event("resize"));  // Snap plots to currently set size
  }

  let title = "Fantasy"

  function switchPage(newPage: string) {
    page = newPage;
    if (page === "overview") {
      title = `Fantasy | ${page}`;
    } else {
      title = `Fantasy | ${page}`;
    }

    let nextPage = page
    if (!window.location.href.endsWith("/")) {
      nextPage = "/fantasy/" + nextPage
    }
    window.history.pushState(null, null, nextPage); // Change current url without reloading
  }

  let pages = ["Attack", "Midfield", "Defence", "Goalkeeper"]
  let data;
  onMount(() => {
    initFantasy()
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
    <Nav team={page} teams={pages} {toAlias} switchTeam={switchPage} />
    <MobileNav
      hyphenatedTeam={page}
      teams={pages}
      {toAlias}
      switchTeam={switchPage}
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

</style>
