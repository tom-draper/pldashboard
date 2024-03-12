<script lang="ts">
  import { onMount } from 'svelte';
  import Overview from './Overview/Overview.svelte';

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

  function playedMatchdayDates(data: DashboardData, team: Team): Date[] {
    let matchdays = playedMatchdays(data, team);

    // If played one or no games, take x-axis from whole season dates
    if (matchdays.length === 0) {
      matchdays = Object.keys(data.fixtures[team]);
    }

    // Find median matchday date across all teams for each matchday
    const x = [];
    for (let i = 0; i < matchdays.length; i++) {
      const matchdayDates = [];
      for (const team in data.standings) {
        matchdayDates.push(new Date(data.fixtures[team][matchdays[i]].date));
      }
      matchdayDates.sort();
      x.push(matchdayDates[Math.floor(matchdayDates.length / 2)]);
    }
    x.sort(function (a, b) {
      return a - b;
    });
    return x;
  }

  async function initDashboard() {
    // Set formatted team name so page header can display while fetching data
    if (data.slug === 'overview') {
      team = 'Overview';
      title = 'Dashboard | Overview';
    } else if (data.slug != null) {
      data.slug = slugAlias(data.slug);
      team = toTitleCase(data.slug.replace(/-/g, ' ')) as Team;
      title = `Dashboard | ${team}`;
    }

    teams = Object.keys(data.data.standings) as Team[];
    if (data.slug === null) {
      // If root, set team to current leader
      team = teams[0];
      title = `Dashboard | ${team}`;
      data.slug = toHyphenatedName(team);
      // Change url to /team-name without reloading page
      history.pushState({}, null, window.location.href + data.slug);
    } else if (team != 'Overview' && team != '' && !teams.includes(team)) {
    //   window.location.href = '/error';
    }
    if (team != 'Overview' && team != '') {
      currentMatchday = getCurrentMatchday(data.data, team);
      playedDates = playedMatchdayDates(data.data, team);
    }

    window.dispatchEvent(new Event('resize')); // Snap plots to currently set size
  }

  function slugAlias(slug: string): string {
    switch (slug) {
      case 'brighton':
        return 'brighton-and-hove-albion';
      case 'palace':
        return 'crystal-palace';
      case 'united':
        return 'manchester-united';
      case 'city':
        return 'city';
      case 'nottingham':
        return 'nottingham-forest';
      case 'luton':
        return 'luton-town';
      case 'sheffield':
        return 'sheffield-united';
      case 'villa':
        return 'aston-villa';
      case 'spurs':
        return 'tottenham-hotspur';
      case 'wolves':
        return 'wolverhampton-wanderers';
      default:
        return slug; // No alias found
    }
  }

  function switchTeam(newTeam: Team) {
    data.slug = newTeam;
    if (data.slug === 'overview') {
      team = 'Overview';
      title = 'Dashboard | Overview';
    } else {
      data.slug = slugAlias(data.slug);
      team = toTitleCase(data.slug.replace(/-/g, ' ')) as Team;
      title = `Dashboard | ${team}`;
      // Overwrite values from new team's perspective using same data
      currentMatchday = getCurrentMatchday(data.data, team);
      playedDates = playedMatchdayDates(data.data, team);
    }

    replaceState(data.slug, {}); // Change current url without reloading
  }

  function lazyLoad() {
    load = true;
    window.dispatchEvent(new Event('resize')); // Snap plots to currently set size
  }

  let y: number;
  let load = false;
  $: y > 30 && lazyLoad();

  let pageWidth: number;
  $: mobileView = pageWidth <= 700;

  let title = 'Dashboard';
  let team: Team | '' | 'Overview' = '';
  let teams: Team[] = []; // Used for nav bar links
  let currentMatchday: string;
  let playedDates: Date[];

  onMount(() => {
    initDashboard();
  });


	export let data;
</script>

<svelte:head>
  <title>{title}</title>
</svelte:head>

<svelte:window bind:innerWidth={pageWidth} bind:scrollY={y} />

  <div id="team">
    <Nav team={data.slug} {teams} {toAlias} {switchTeam} />
    <MobileNav
      hyphenatedTeam={data.slug}
      {teams}
      {toAlias}
      {switchTeam}
      {toggleMobileNav}
    />
    {#if teams.length === 0}
      <!-- Navigation disabled while teams list are loading -->
      <button id="mobileNavBtn" style="cursor: default">Select Team</button>
    {:else}
      <button id="mobileNavBtn" on:click={toggleMobileNav}>
        Select Team
      </button>
    {/if}

    <div id="dashboard">
      <div class="header" style="background-color: var(--{data.slug});">
        <a class="main-link no-decoration" href="/{data.slug}">
          <div class="title" style="color: var(--{data.slug + '-secondary'});">
            {team == '' || team == 'Overview' ? team : toAlias(team)}
          </div>
        </a>
      </div>

	  {#if team}
        <Overview data={data.data} />
        <Footer lastUpdated={data.data.lastUpdated} />
      {:else}
        <div class="loading-spinner-container">
          <div class="loading-spinner" />
        </div>
      {/if} 
    </div>
  </div>

<style scoped>
  .header {
    display: grid;
    place-items: center;
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
  .lowered {
    margin-bottom: -9px;
  }
  .page-content {
    position: relative;
  }
  #team {
    display: flex;
    overflow-x: hidden;
    font-size: 15px;
  }

  .position-no-badge {
    padding-left: 0;
    margin: 0;
    height: 500px;
  }

  .position-central {
    text-shadow: 9px 9px #000;
    font-weight: 800;
    font-size: 430px;
    user-select: none;
    max-width: 500px;
  }

  .position-central {
    text-align: center;
    margin-top: 0.1em;
    max-height: 500px;
    margin-left: 0.05em;
    font-size: 20vw;
    color: #333;
  }

  .circles-background-container {
    position: absolute;
    align-self: center;
    width: 500px;
    z-index: -10;
  }

  .circles-background {
    height: 500px;
    width: 500px;
    transform: scale(0.95);
  }

  #dashboard {
    margin-left: 220px;
    width: 100%;
  }

  .fixtures-graph {
    display: flex;
    flex-direction: column;
  }

  .clean-sheets {
    height: 60px;
  }

  .no-bottom-margin {
    margin-bottom: 0 !important;
  }
  .small-bottom-margin {
    margin-bottom: 1.5rem !important;
  }
  .page-content {
    display: flex;
    flex-direction: column;
    text-align: center;
  }

  .row {
    position: relative;
    display: flex;
    margin-bottom: 3rem;
    height: auto;
  }
  .row-graph {
    width: 100%;
  }
  .score-freq {
    margin: 0 8% 0 8%;
  }
  .row-left {
    display: flex;
    flex-direction: column;
    padding-right: auto;
    margin-right: 1.5em;
    text-justify: center;
    flex: 4;
  }
  .row-right {
    flex: 10;
  }
  .multi-element-row {
    margin: 0 1.4em 3rem;
  }

  .spider-chart-row {
    display: grid;
    place-items: center;
  }
  .spider-chart-container {
    margin: 1em auto auto;
    display: flex;
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

  @media only screen and (min-width: 2400px) {
    .position-central {
      font-size: 16vw;
    }
  }
  @media only screen and (min-width: 2200px) {
    .position-central {
      font-size: 18vw;
    }
  }
  @media only screen and (min-width: 2000px) {
    .position-central {
      font-size: 20vw;
    }
  }
  @media only screen and (max-width: 1800px) {
    .circles-background {
      transform: scale(0.9);
    }
    .position-central {
      font-size: 20vw;
      margin-top: 0.2em;
    }
  }
  @media only screen and (max-width: 1600px) {
    .row-left {
      flex: 5;
    }
    .circles-background {
      transform: scale(0.85);
    }
  }
  @media only screen and (max-width: 1500px) {
    .circles-background {
      transform: scale(0.8);
    }
    .position-central {
      font-size: 22vw;
    }
  }
  @media only screen and (max-width: 1400px) {
    .circles-background {
      transform: scale(0.75);
    }
    .position-central {
      margin-top: 0.25em;
    }
  }

  @media only screen and (min-width: 1200px) {
    #mobileNavBtn {
      display: none;
    }
  }

  @media only screen and (max-width: 1200px) {
    .position-central {
      margin-top: 0.3em;
    }
    .circles-background {
      transform: scale(0.7);
    }
    #dashboard {
      margin-left: 0;
    }
    .position-central {
      font-size: 24vw;
    }
  }

  @media only screen and (min-width: 1100px) {
    .form-details {
      width: 80%;
      align-items: center;
    }
  }

  @media only screen and (max-width: 1000px) {
    .row {
      flex-direction: column;
      margin-bottom: 40px;
    }
    .row-graph {
      width: auto;
    }
    .score-freq {
      margin: 0 0 10px;
    }

    .multi-element-row {
      margin: 0;
    }
    .row-left {
      margin-right: 0;
      align-self: center;
      width: 80%;
    }

    .position-no-badge {
      height: 400px;
      width: 500px;
    }
    .position-central {
      margin: auto;
    }

    .circles-background {
      transform: scale(0.48);
      margin-top: -100px;
    }

    .position-central,
    .circles-background-container {
      align-self: center;
    }
    .spider-chart-container {
      flex-direction: column;
      width: 100%;
    }
    .full-row-graph {
      margin: 0;
    }
  }

  @media only screen and (max-width: 900px) {
    .circles-background {
      transform: scale(0.45);
      margin-top: -120px;
    }
    .position-central {
      font-size: 25vw;
    }
  }

  @media only screen and (max-width: 700px) {
    .circles-background {
      transform: scale(0.55);
      margin-top: -5em;
    }

    .position-no-badge {
      height: 330px;
    }

    .position-central {
      font-size: 250px;
      margin: 35px 0 0 0;
    }
  }

  @media only screen and (max-width: 800px) {
    .circles-background {
      transform: scale(0.4);
      margin-top: -9em;
    }
    .position-central {
      font-size: 13em;
    }
    .season-stats-row {
      margin: 1em;
    }
    .row-graph {
      margin: 0;
    }
  }

  @media only screen and (max-width: 550px) {
    .position-central {
      font-size: 10em;
      text-align: center;
      line-height: 1.55;
      padding-right: 20px;
      margin: 0;
      text-shadow: 7px 7px #000;
    }
    .multi-element-row {
      margin: 0;
    }

    .season-stats-row {
      margin: 0 1em 1em;
    }
    .form-details {
      width: 95%;
    }
    .position-no-badge {
      padding: 0 !important;
      margin: 0 !important;
      width: 100%;
    }

    .circles-background {
      transform: scale(0.35);
      margin-top: -9.5em;
    }

    .lowered {
      margin: 0 30px;
    }
  }
</style>

