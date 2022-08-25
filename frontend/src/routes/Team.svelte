<script lang="ts">
  import { Router } from "svelte-routing";
  import { onMount } from "svelte";
  import CurrentForm from "../components/current_form/CurrentForm.svelte";
  import TableSnippet from "../components/TableSnippet.svelte";
  import NextGame from "../components/next_game/NextGame.svelte";
  import StatsValues from "../components/StatsValues.svelte";
  import TeamsFooter from "../components/TeamsFooter.svelte";
  import FixturesGraph from "../components/FixturesGraph.svelte";
  import FormOverTimeGraph from "../components/FormOverTimeGraph.svelte";
  import PositionOverTimeGraph from "../components/PositionOverTimeGraph.svelte";
  import GoalsScoredAndConcededGraph from "../components/goals_scored_and_conceded/GoalsScoredAndConcededGraph.svelte";
  import CleanSheetsGraph from "../components/goals_scored_and_conceded/CleanSheetsGraph.svelte";
  import GoalsPerGame from "../components/goals_per_game/GoalsPerGame.svelte";
  import SpiderGraph from "../components/SpiderGraph.svelte";
  import ScorelineFreqGraph from "../components/ScorelineFreqGraph.svelte";
  import Nav from "../components/nav/Nav.svelte";
  import MobileNav from "../components/nav/MobileNav.svelte";

  let alias = {
    "Wolverhampton Wanderers": "Wolves",
    "Tottenham Hotspur": "Spurs",
    "Leeds United": "Leeds",
    "West Ham United": "West Ham",
    "Brighton and Hove Albion": "Brighton",
  };

  function toInitials(team: string): string {
    switch (team) {
      case "Brighton and Hove Albion":
        return "BHA";
      case "Manchester City":
        return "MCI";
      case "Manchester United":
        return "MUN";
      case "Aston Villa":
        return "AVL";
      case "Sheffield United":
        return "SHU";
      case "West Bromwich Albion":
        return "WBA";
      case "West Ham United":
        return "WHU";
    }
    return team.slice(0, 3).toUpperCase();
  }

  function toAlias(team: string): string {
    if (team in alias) {
      return alias[team];
    }
    return team;
  }

  function toName(teamAlias: string): string {
    if (!Object.values(alias).includes(teamAlias)) {
      return teamAlias;
    }
    return Object.keys(alias).find((key) => alias[key] === teamAlias);
  }

  function toggleMobileNav() {
    let mobileNav = document.getElementById('mobileNav');
    if (mobileNav.style.width == "0px") {
      mobileNav.style.animation = 'appear 0.1s ease-in 1';
      mobileNav.style.width = "100%";
    } else {
      mobileNav.style.animation = null;
      mobileNav.style.width = "0px";
    }
  }

  // Teams in the final position from last season (21/22), including championship teams
  // Used for nav bar links order
  let teams = [
    "Manchester City",
    "Liverpool",
    "Chelsea",
    "Tottenham Hotspur",
    "Arsenal",
    "Manchester United",
    "West Ham United",
    "Leicester City",
    "Brighton and Hove Albion",
    "Wolverhampton Wanderers",
    "Newcastle United",
    "Crystal Palace",
    "Brentford",
    "Aston Villa",
    "Southampton",
    "Everton",
    "Leeds United",
    "Fulham",
    "Bournemouth",
    "Nottingham Forest",
  ];

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

  function getPlayedMatchdays(data, team: string): string[] {
    let matchdays = Object.keys(data.form[data._id][team]);

    // If played one or no games, take x-axis from whole season dates
    if (matchdays.length == 0) {
      matchdays = Object.keys(data.fixtures[team]);
    }

    // Find median matchday date across all teams for each matchday
    let x = [];
    for (let matchday of matchdays) {
      let matchdayDates = [];
      data.teamNames.forEach((team: string) => {
        matchdayDates.push(data.fixtures[team][matchday].date);
      });
      matchdayDates = matchdayDates.map((val) => {
        return new Date(val);
      });
      matchdayDates = matchdayDates.sort();
      x.push(matchdayDates[Math.floor(matchdayDates.length / 2)]);
    }
    x.sort(function (a, b) {
      return a - b;
    });
    return x;
  }

  function getCurrentMatchday(data: TeamData, team: string): null|string {
    if (Object.keys(data.form[data._id][team]).length == 0) {
      return null; // Season has not started yet
    }
    return Object.keys(data.form[data._id][team]).reduce(
      (matchday1, matchday2) =>
        data.form[data._id][team][matchday1] >
        data.form[data._id][team][matchday2]
          ? matchday1
          : matchday2
    );
  }

  async function fetchData(address: string): Promise<TeamData> {
    const response = await fetch(address);
    let json = await response.json();
    return json;
  }

  function initDashboard() {
    team = toTitleCase(hyphenatedTeam.replace(/\-/g, " "));
    fetchData("https://pldashboard.herokuapp.com/api/teams")
      .then((json: TeamData) => {
        // Build teamData package from json data
        json.teamNames = Object.keys(json.standings);
        currentMatchday = getCurrentMatchday(json, team);
        playedMatchdays = getPlayedMatchdays(json, team);
        data = json;
        console.log(data);
      })
      .then(() => {
        window.dispatchEvent(new Event("resize"));
      });
  }

  function switchTeam(newTeam: string) {
    hyphenatedTeam = newTeam;
    team = toTitleCase(hyphenatedTeam.replace(/\-/g, " "));
    currentMatchday = getCurrentMatchday(data, team);
    playedMatchdays = getPlayedMatchdays(data, team);
    window.history.pushState(null, null, hyphenatedTeam); // Change current url without reloading
  }

  let pageWidth: number;
  $: mobileView = pageWidth <= 700;
  const showBadge = false;
  let team = "";
  let currentMatchday: string, playedMatchdays: string[];
  let data: TeamData;
  onMount(() => {
    initDashboard();
  });

  export let hyphenatedTeam: string;
</script>

<svelte:head>
  <title>{team}</title>
  <meta name="description" content="Premier League Statistics Dashboard" />
</svelte:head>

<svelte:window bind:innerWidth={pageWidth}/>

<Router>
  <div id="team">
    <Nav team={hyphenatedTeam} {teams} {toAlias} {switchTeam} />
    <MobileNav {hyphenatedTeam} {teams} {toAlias} {switchTeam} {toggleMobileNav} />
    <button id="mobileNavBtn" on:click={toggleMobileNav}> Select Team </button>

    <div id="dashboard">
      <div class="header" style="background-color: var(--{hyphenatedTeam});">
        <a class="main-link no-decoration" href="/{hyphenatedTeam}">
          <div
            class="title"
            style="color: var(--{hyphenatedTeam + '-secondary'});"
          >
            {toAlias(team)}
          </div>
        </a>
      </div>

      {#if data != undefined && false}
        <div class="page-content">
          <div class="row multi-element-row small-bottom-margin">
            {#if showBadge}
              <div
                class="row-left position-and-badge"
                style="background-image: url('{data.logoURLs[team]}')"
              >
                <div class="position">
                  {data.standings[team][data._id].position}
                </div>
              </div>
            {:else}
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
            {/if}
            <div class="row-right fixtures-graph row-graph">
              <h1 class="lowered">Fixtures</h1>
              <div class="graph mini-graph mobile-margin">
                <FixturesGraph {data} {team} {mobileView} />
              </div>
            </div>
          </div>

          <div class="row multi-element-row">
            <div class="row-left form-details">
              <CurrentForm {data} {currentMatchday} {team} {toInitials} />
              <TableSnippet
                {data}
                {hyphenatedTeam}
                {team}
                {switchTeam}
                {toAlias}
              />
            </div>
            <div class="row-right">
              <NextGame
                {data}
                {currentMatchday}
                {team}
                {showBadge}
                {toAlias}
                {toInitials}
                {switchTeam}
              />
            </div>
          </div>

          <div class="row">
            <div class="form-graph row-graph">
              <h1 class="lowered">Form Over Time</h1>
              <div class="graph full-row-graph">
                <FormOverTimeGraph {data} {team} {playedMatchdays} {mobileView} />
              </div>
            </div>
          </div>

          <div class="row">
            <div class="position-over-time-graph row-graph">
              <h1 class="lowered">Position Over Time</h1>
              <div class="graph full-row-graph">
                <PositionOverTimeGraph {data} {team} {playedMatchdays} {mobileView} />
              </div>
            </div>
          </div>

          <div class="row no-bottom-margin">
            <div class="goals-scored-vs-conceded-graph row-graph">
              <h1 class="lowered">Goals Scored and Conceded</h1>
              <div class="graph full-row-graph">
                <GoalsScoredAndConcededGraph {data} {team} {playedMatchdays} {mobileView} />
              </div>
            </div>
          </div>

          <div class="row">
            <div class="row-graph">
              <div class="clean-sheets graph full-row-graph">
                <CleanSheetsGraph {data} {team} {playedMatchdays} {mobileView} />
              </div>
            </div>
          </div>

          <div class="season-stats-row">
            <StatsValues {data} {team} />
          </div>

          <div class="row">
            <div class="goals-freq-row row-graph">
              <h1>Goals Per Game</h1>
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
                <SpiderGraph {data} {team} {teams} {toAlias} {toName} />
              </div>
            </div>
          </div>

          <TeamsFooter lastUpdated={data.lastUpdated} />
        </div>
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
    font-size: 2.5rem;
    width: fit-content;
  }
  .page-content {
    position: relative;
  }
  #team {
    display: flex;
    overflow-x: hidden;
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
    margin-right: 1.5vw;
    text-justify: center;
    flex: 4;
  }
  .row-right {
    flex: 10;
  }
  .multi-element-row {
    margin: 0 20px 3rem 20px;
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
    background: #38003d;
    padding: 0.8em 0;
    cursor: pointer;
    font-size: 1.1em;
    z-index: 1;
    width: 100%;
    bottom: 0;
    border: none;
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
  @media only screen and (max-width: 1300px) {
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
  @media only screen and (min-width: 1300px) {
    #mobileNavBtn {
      display: none;
    }
  }

  @media only screen and (max-width: 1200px) {
    .position-central {
      margin-top: 0.3em;
    }
  }
  @media only screen and (max-width: 1100px) {
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
  }

  @media only screen and (max-width: 1000px) {
    .spider-chart-container {
      flex-direction: column;
      width: 100%;
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
      margin-top: -85px;
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
      margin-top: -120px;
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
      line-height: 1.6;
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

    .position-no-badge,
    .position-and-badge {
      padding: 0 !important;
      margin: 0 !important;
      width: 100%;
    }

    .circles-background {
      transform: scale(0.35);
      margin-top: -125px;
    }
  }
</style>
