<script lang="ts">
  import { Router } from "svelte-routing";
  import { onMount } from "svelte";
  import CurrentForm from "../components/team/current_form/CurrentForm.svelte";
  import TableSnippet from "../components/team/TableSnippet.svelte";
  import NextGame from "../components/team/NextGame.svelte";
  import StatsValues from "../components/team/goals_scored_and_conceded/StatsValues.svelte";
  import TeamsFooter from "../components/team/Footer.svelte";
  import FixturesGraph from "../components/team/FixturesGraph.svelte";
  import FormOverTimeGraph from "../components/team/FormOverTimeGraph.svelte";
  import PositionOverTimeGraph from "../components/team/PositionOverTimeGraph.svelte";
  import PointsOverTimeGraph from "../components/team/PointsOverTimeGraph.svelte";
  import GoalsScoredAndConcededGraph from "../components/team/goals_scored_and_conceded/ScoredConcededPerGameGraph.svelte";
  import CleanSheetsGraph from "../components/team/goals_scored_and_conceded/CleanSheetsGraph.svelte";
  import GoalsPerGame from "../components/team/goals_per_game/GoalsPerGame.svelte";
  import SpiderGraph from "../components/team/SpiderGraph.svelte";
  import ScorelineFreqGraph from "../components/team/ScorelineFreqGraph.svelte";
  import Nav from "../components/nav/Nav.svelte";
  import Overview from "../components/overview/Overview.svelte";
  import MobileNav from "../components/nav/MobileNav.svelte";
  import ScoredConcededOverTimeGraph from "../components/team/goals_scored_and_conceded/ScoredConcededOverTimeGraph.svelte";
  import { toAlias, toHyphenatedName, playedMatchdays, currentMatchday as getCurrentMatchday } from "../lib/team";

  function toggleMobileNav() {
    let mobileNav = document.getElementById("mobileNav");
    if (mobileNav.style.width === "0px") {
      mobileNav.style.width = "100%";
    } else {
      mobileNav.style.width = "0px";
    }
  }

  function toTitleCase(str: string): string {
    return str
      .toLowerCase()
      .split(" ")
      .map(function (word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ")
      .replace("And", "and");
  }

  function playedMatchdayDates(data: TeamData, team: string): Date[] {
    let matchdays = playedMatchdays(data, team);

    // If played one or no games, take x-axis from whole season dates
    if (matchdays.length === 0) {
      matchdays = Object.keys(data.fixtures[team]);
    }

    // Find median matchday date across all teams for each matchday
    let x = [];
    for (let i = 0; i < matchdays.length; i++) {
      let matchdayDates = [];
      for (let team in data.standings) {
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
    if (hyphenatedTeam === "overview") {
      team = "Overview";
      title = `Dashboard | ${team}`;
      hyphenatedTeam = "overview";
    } else if (hyphenatedTeam != null) {
      team = toTitleCase(hyphenatedTeam.replace(/\-/g, " "));
      title = `Dashboard | ${team}`;
    }

    const response = await fetch("https://pldashboard-backend.vercel.app/api/teams");
    let json = await response.json();

    teams = Object.keys(json.standings);
    if (hyphenatedTeam === null) {
      // If root, set team to current leader
      team = teams[0];
      title = `Dashboard | ${team}`;
      hyphenatedTeam = toHyphenatedName(team);
      // Change url to /team-name without reloading page
      history.pushState({}, null, window.location.href + hyphenatedTeam);
    } else if (team != "Overview" && !teams.includes(team)) {
      window.location.href = "/error";
    }
    if (team != "Overview") {
      currentMatchday = getCurrentMatchday(json, team);
      playedDates = playedMatchdayDates(json, team);
    }
    data = json;
    console.log(data);

    window.dispatchEvent(new Event("resize"));  // Snap plots to currently set size
  }

  function switchTeam(newTeam: string) {
    hyphenatedTeam = newTeam;
    if (hyphenatedTeam === "overview") {
      team = "Overview";
      title = `Dashboard | ${team}`;
    } else {
      team = toTitleCase(hyphenatedTeam.replace(/\-/g, " "));
      title = `Dashboard | ${team}`;
      // Overwrite values from new team's perspective using same data
      currentMatchday = getCurrentMatchday(data, team);
      playedDates = playedMatchdayDates(data, team);
    }
    window.history.pushState(null, null, hyphenatedTeam); // Change current url without reloading
  }

  function lazyLoad() {
    load = true;
    window.dispatchEvent(new Event("resize"));  // Snap plots to currently set size
  }

  let y: number;
  let load = false;
  $: y > 30 && lazyLoad();

  let pageWidth: number;
  $: mobileView = pageWidth <= 700;

  let title = "Dashboard";
  let team = "";
  let teams: string[] = []; // Used for nav bar links
  let currentMatchday: string
  let playedDates: Date[];

  let data: TeamData;
  onMount(() => {
    initDashboard();
  });

  export let hyphenatedTeam: string;
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content="Premier League Statistics Dashboard" />
</svelte:head>

<svelte:window bind:innerWidth={pageWidth} bind:scrollY={y} />

<Router>
  <div id="team">
    <Nav team={hyphenatedTeam} {teams} {toAlias} {switchTeam} />
    <MobileNav
      {hyphenatedTeam}
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
      <div class="header" style="background-color: var(--{hyphenatedTeam});">
        <a class="main-link no-decoration" href="/{hyphenatedTeam}">
          <div
            class="title"
            style="color: var(--{hyphenatedTeam + '-secondary'});"
          >
            {hyphenatedTeam != "overview" ? toAlias(team) : "Overview"}
          </div>
        </a>
      </div>

      {#if data != undefined}
        {#if hyphenatedTeam === "overview"}
          <Overview {data} />
        {:else}
          <div class="page-content">
            <div class="row multi-element-row small-bottom-margin">
              <div class="row-left position-no-badge">
                <div class="circles-background-container">
                  <svg class="circles-background">
                    <circle
                      cx="300"
                      cy="150"
                      r="100"
                      stroke-width="0"
                      fill="var(--{hyphenatedTeam}-secondary)"
                    />
                    <circle
                      cx="170"
                      cy="170"
                      r="140"
                      stroke-width="0"
                      fill="var(--{hyphenatedTeam})"
                    />
                    <circle
                      cx="300"
                      cy="320"
                      r="170"
                      stroke-width="0"
                      fill="var(--{hyphenatedTeam})"
                    />
                  </svg>
                </div>
                <div class="position-central">
                  {data.standings[team][data._id].position}
                </div>
              </div>
              <div class="row-right fixtures-graph row-graph">
                <h1 class="lowered">Fixtures</h1>
                <div class="graph mini-graph mobile-margin">
                  <FixturesGraph {data} {team} {mobileView} />
                </div>
              </div>
            </div>

            <div class="row multi-element-row">
              <div class="row-left form-details">
                <CurrentForm {data} currentMatchday={currentMatchday} {team} />
                <TableSnippet {data} {hyphenatedTeam} {team} {switchTeam} />
              </div>
              <div class="row-right">
                <NextGame {data} {team} {switchTeam} />
              </div>
            </div>

            <div class="row">
              <div class="form-graph row-graph">
                <h1 class="lowered">Form</h1>
                <div class="graph full-row-graph">
                  <FormOverTimeGraph
                    {data}
                    {team}
                    {playedDates}
                    bind:lazyLoad={load}
                    {mobileView}
                  />
                </div>
              </div>
            </div>

            {#if load}
              <div class="row">
                <div class="position-over-time-graph row-graph">
                  <h1 class="lowered">Position</h1>
                  <div class="graph full-row-graph">
                    <PositionOverTimeGraph
                      {data}
                      {team}
                      {mobileView}
                    />
                  </div>
                </div>
              </div>

              <div class="row">
                <div class="position-over-time-graph row-graph">
                  <h1 class="lowered">Points</h1>
                  <div class="graph full-row-graph">
                    <PointsOverTimeGraph
                      {data}
                      {team}
                      {mobileView}
                    />
                  </div>
                </div>
              </div>

              <div class="row no-bottom-margin">
                <div class="goals-scored-vs-conceded-graph row-graph">
                  <h1 class="lowered">Goals Per Game</h1>
                  <div class="graph full-row-graph">
                    <GoalsScoredAndConcededGraph
                      {data}
                      {team}
                      {playedDates}
                      {mobileView}
                    />
                  </div>
                </div>
              </div>

              <div class="row">
                <div class="row-graph">
                  <div class="clean-sheets graph full-row-graph">
                    <CleanSheetsGraph
                      {data}
                      {team}
                      {playedDates}
                      {mobileView}
                    />
                  </div>
                </div>
              </div>

              <div class="season-stats-row">
                <StatsValues {data} {team} />
              </div>

              <div class="row">
                <div class="row-graph">
                  <div class="graph full-row-graph">
                    <ScoredConcededOverTimeGraph {data} {team} {mobileView} />
                  </div>
                </div>
              </div>

              <div class="row">
                <div class="goals-freq-row row-graph">
                  <h1>Scorelines</h1>
                  <GoalsPerGame {data} {team} {mobileView} />
                </div>
              </div>

              <div class="row">
                <div class="row-graph">
                  <div class="score-freq graph">
                    <ScorelineFreqGraph {data} {team} {mobileView} />
                  </div>
                </div>
              </div>

              <div class="row">
                <div class="spider-chart-row row-graph">
                  <h1>Team Comparison</h1>
                  <div class="spider-chart-container">
                    <SpiderGraph {data} {team} {teams} />
                  </div>
                </div>
              </div>

              <TeamsFooter lastUpdated={data.lastUpdated} />
            {/if}
          </div>
        {/if}
      {:else}
        <div class="loading-spinner-container">
          <div class="loading-spinner" />
        </div>
      {/if}
    </div>
  </div>
</Router>

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
  .position-and-badge {
    height: 500px;
    background-repeat: no-repeat;
    background-size: auto 450px;
    background-position: right center;
  }

  .position-no-badge {
    padding-left: 0;
    margin: 0;
    height: 500px;
  }

  .position-central,
  .position {
    text-shadow: 9px 9px #000;
    font-weight: 800;
    font-size: 430px;
    user-select: none;
    max-width: 500px;
  }

  .position {
    text-align: left;
    margin-top: 0.02em;
    margin-left: 30px;
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

    .position-and-badge {
      width: 50%;
      max-width: 400px;
      min-width: 150px;
      padding-right: 3% !important;
      background-size: auto 330px !important;
      height: 400px;
      margin-bottom: -50px;
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
      margin: 0 1em;
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
    .position-and-badge {
      width: 70%;
    }

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
    .position,
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

    .position-and-badge {
      background-size: auto 210px !important;
      background-position: center !important;
    }
    .season-stats-row {
      margin: 0 1em 1em;
    }
    .form-details {
      width: 95%;
    }
    .position-no-badge,
    .position-and-badge {
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
