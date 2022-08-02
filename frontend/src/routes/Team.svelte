<script>
  import { Router } from "svelte-routing";
  import { onMount } from "svelte";
  import CurrentForm from "../components/CurrentForm.svelte";
  import TableSnippet from "../components/TableSnippet.svelte";
  import NextGame from "../components/next_game/NextGame.svelte";
  import SeasonStats from "../components/SeasonStats.svelte";
  import TeamsFooter from "../components/TeamsFooter.svelte";
  import Fixtures from "../components/Fixtures.svelte";
  import FormOverTime from "../components/FormOverTime.svelte";
  import PositionOverTime from "../components/PositionOverTime.svelte";
  import GoalsScoredAndConceded from "../components/goals_scored_and_conceded/GoalsScoredAndConceded.svelte";
  import CleanSheets from "../components/goals_scored_and_conceded/CleanSheets.svelte";
  import GoalFrequencies from "../components/goals_per_game/GoalsPerGame.svelte";
  import Spider from "../components/Spider.svelte";
  import NavBar from "../components/NavBar.svelte";

  function toTitleCase(str) {
    return str
      .toLowerCase()
      .split(" ")
      .map(function (word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ")
      .replace("And", "and");
  }

  function getCurrentMatchday(data, fullTeamName) {
    if (Object.keys(data.form[data.currentSeason][fullTeamName]).length == 0) {
      return null; // Season has not started yet
    }
    return Object.keys(data.form[data.currentSeason][fullTeamName]).reduce(
      (a, b) =>
        data.form[data.currentSeason][fullTeamName][a] >
        data.form[data.currentSeason][fullTeamName][b]
          ? a
          : b
    );
  }

  function openNavBar() {
    document.getElementById('navBar').style.display = 'block';
    document.getElementById('dashboard').style.marginLeft = '200px';
  }

  async function fetchData(address) {
    const response = await fetch(address);
    let json = await response.json();
    return json;
  }

  const showBadge = false;
  let fullTeamName = "";
  let currentMatchday;
  let data;
  onMount(() => {
    fullTeamName = toTitleCase(team.replace(/\-/g, " "));
    fetchData("http://127.0.0.1:5000/teams")
      // fetchData("https://pldashboard.herokuapp.com/teams")
      .then((json) => {
        // Build teamData package from json data
        currentMatchday = getCurrentMatchday(json, fullTeamName);
        data = json;
        console.log(data);
      })
      .then(() => {
        window.dispatchEvent(new Event("resize"));
      });
  });

  export let team;
</script>

<svelte:head>
  <title>{fullTeamName}</title>
  <meta name="description" content="Premier League Statistics Dashboard" />
</svelte:head>

<Router>
  <div id="team">
    <div id="navBar">
      <NavBar thisTeam={team} />
    </div>
    <div id="dashboard">
      <div class="header" style="background-color: var(--{team});">
        <a href="/{team}">
          <div
            class="main-link title no-decoration"
            style="color: var(--{team + '-secondary'});"
          >
            {fullTeamName}
          </div>
        </a>
      </div>

      {#if data != undefined}
        <div class="page-content">
          <div class="row multi-element-row">
            {#if showBadge}
              <div
                class="row-left position-and-badge"
                style="background-image: url('{data.logoURLs[fullTeamName]}')"
              >
                <div class="position">
                  {data.standings[fullTeamName][data.currentSeason].position}
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
                      fill="var(--{team}-secondary)"
                    />
                    <circle
                      cx="170"
                      cy="170"
                      r="140"
                      stroke-width="0"
                      fill="var(--{team})"
                    />
                    <circle
                      cx="300"
                      cy="320"
                      r="170"
                      stroke-width="0"
                      fill="var(--{team})"
                    />
                  </svg>
                </div>
                <div class="position-central">
                  {data.standings[fullTeamName][data.currentSeason].position}
                </div>
              </div>
            {/if}
            <div class="row-right fixtures-graph row-graph">
              <h1 class="lowered">Fixtures</h1>
              <div class="graph mini-graph">
                <Fixtures {data} {fullTeamName} />
              </div>
            </div>
          </div>

          <div class="row multi-element-row">
            <div class="row-left form-details">
              <CurrentForm {data} {currentMatchday} {fullTeamName} />
              <TableSnippet {data} {team} {fullTeamName} />
            </div>
            <div class="row-right">
              <NextGame {data} {currentMatchday} {fullTeamName} {showBadge} />
            </div>
          </div>

          <div class="row">
            <div class="form-graph row-graph">
              <h1 class="lowered">Form Over Time</h1>
              <div class="graph full-row-graph">
                <FormOverTime {data} {fullTeamName} />
              </div>
            </div>
          </div>

          <div class="row">
            <div class="position-over-time-graph row-graph">
              <h1 class="lowered">Position Over Time</h1>
              <div class="graph full-row-graph">
                <PositionOverTime {data} {fullTeamName} />
              </div>
            </div>
          </div>

          <div class="row no-bottom-margin">
            <div class="goals-scored-vs-conceded-graph row-graph">
              <h1 class="lowered">Goals Scored and Conceded</h1>
              <div class="graph full-row-graph">
                <GoalsScoredAndConceded {data} {fullTeamName} />
              </div>
            </div>
          </div>

          <div class="row">
            <div class="row-graph">
              <div class="clean-sheets graph full-row-graph">
                <CleanSheets {data} {fullTeamName} />
              </div>
            </div>
          </div>

          <div class="season-stats-row">
            <SeasonStats {data} {fullTeamName} />
          </div>

          <div class="row">
            <div class="goals-freq-row row-graph">
              <h1>Goals Per Game</h1>
              <GoalFrequencies {data} {fullTeamName} />
            </div>
          </div>

          <div class="row">
            <div class="spider-chart-row row-graph">
              <div class="spider-chart-container">
                <Spider {data} {fullTeamName} />
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
  .main-link {
    margin: 10px auto;
    width: fit-content;
  }
  .page-content {
    position: relative;
  }
  #team {
    display: flex;
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
    /* width: 860px; */
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
    margin-top: 0.04em;
    max-height: 500px;
    margin-left: 0.05em;
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
  .position-central {
    font-size: 23vw;
    margin: auto;
  }

  #dashboard {
    margin-left: 220px;
    width: 100%;
  }

  .open-nav-bar-btn {
    cursor: pointer;
    position: absolute;
    top: 0.9em;
    left: 0.6em;
    background: transparent;
    border: none;
    outline: none;
    z-index: 50;
  }

  .row-graph {
    width: 100%;
  }
  .row-left {
    display: flex;
    flex-direction: column;
    /* width: 800px; */
    padding-right: auto;
    /* margin: 0 40px; */
    margin-right: 20px;
    text-justify: center;
    flex: 4;
  }
  .row-right {
    flex: 10;
  }
  .multi-element-row {
    margin: 0 20px;
  }

  .spider-chart-row {
    display: grid;
    place-items: center;
  }
  .spider-chart-container {
    margin: 1em auto auto;
    display: flex;
  }

  @media only screen and (max-width: 1800px) {
    .circles-background {
      transform: scale(0.9);
    }
    .position-central {
      font-size: 25vw;
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
  }
  @media only screen and (max-width: 1400px) {
    .circles-background {
      transform: scale(0.75);
    }
    #navBar {
      display: none;
    }
    #dashboard {
      margin-left: 0;
    }
  }
  @media only screen and (max-width: 1300px) {
    .circles-background {
      transform: scale(0.7);
    }
  }

  @media only screen and (max-width: 1200px) {
    .circles-background {
      transform: scale(0.5);
      margin-top: -90px;
    }
  }
  @media only screen and (max-width: 1200px) {
    .circles-background {
      margin-top: -100px;
    }
  }
  @media only screen and (max-width: 1000px) {
    .circles-background {
      transform: scale(0.5);
      margin-top: -110px;
    }
  }

  @media only screen and (max-width: 800px) {
    .circles-background {
      transform: scale(0.45);
      margin-top: -120px;
    }
    .position-central {
      font-size: 13em;
    }
    /* .position-no-badge {
    margin-bottom: -20px;
  } */
    .season-stats-row {
      margin: 10px;
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

    /* .position-and-badge,
  .position-no-badge,
  .circles-background-container {
    height: 200px;
  } */

    .circles-background {
      transform: scale(0.35);
      margin-top: -125px;
    }
  }
</style>
