<script>
  import { Router } from "svelte-routing";
  import { onMount } from "svelte";
  import CurrentForm from "../components/CurrentForm.svelte";
  import TableSnippet from "../components/TableSnippet.svelte";
  import NextGame from "../components/NextGame.svelte";
  import SeasonStats from "../components/SeasonStats.svelte";
  import TeamsFooter from "../components/TeamsFooter.svelte";
  import Fixtures from "../components/Fixtures.svelte";
  import FormOverTime from "../components/FormOverTime.svelte";
  import PositionOverTime from "../components/PositionOverTime.svelte";
  import GoalsScoredAndConceded from "../components/GoalsScoredAndConceded.svelte";
  import CleanSheets from "../components/CleanSheets.svelte";
  import GoalFrequencies from "../components/GoalFrequencies.svelte";

  function toTitleCase(str) {
    return str
      .toLowerCase()
      .split(" ")
      .map(function (word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }

  function getCurrentMatchday(data, fullTeamName) {
    return Object.keys(data.form[fullTeamName]).reduce((a, b) =>
      data.form[fullTeamName][a] > data.form[fullTeamName][b] ? a : b
    );
  }

  async function fetchData(address) {
    const response = await fetch(address);
    let json = await response.json();
    return json;
  }

  let fullTeamName = "";
  let currentMatchday;
  let data;
  onMount(() => {
    fullTeamName = toTitleCase(team.replace(/\-/g, " ")) + " FC";
    fetchData("https://pldashboard.herokuapp.com/teams").then((json) => {
      // Build teamData package from json data
      currentMatchday = getCurrentMatchday(json, fullTeamName);
      data = json;
      console.log(data);
    });
  });

  export let team;
</script>

<svelte:head>
  <title>{fullTeamName}</title>
  <meta name="description" content="Premier League Statistics Dashboard" />
</svelte:head>

<Router>
  <div class="header" style="background-color: var(--{team});">
    <div
      class="main-link title no-decoration"
      style="color: var(--{team + '-secondary'});"
    >
      {fullTeamName}
    </div>
  </div>

  {#if data != undefined}
    <div class="page-content">
      <div class="row">
        <div
          class="row-left position-and-badge"
          style="background-image: url('{data.logoURLs[fullTeamName]}')"
        >
          <div class="position">
            {data.standings[fullTeamName][data.currentSeason].position}
          </div>
        </div>
        <div class="fixtures-graph row-graph">
          <h1 class="lowered">Fixtures</h1>
          <div class="graph mini-graph">
            <Fixtures {data} {fullTeamName} />
          </div>
        </div>
      </div>

      <div class="row">
        <div class="row-left form-details">
          <CurrentForm {data} {currentMatchday} {fullTeamName} />
          <TableSnippet {data} {team} {fullTeamName} />
        </div>
        <NextGame {data} {currentMatchday} {fullTeamName} />
      </div>

      <div class="row">
        <div class="form-graph row-graph">
          <h1 class="lowered">Form Over Time</h1>
          <div class="graph full-row-graph" style="height: auto">
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

      <div class="row no-bottom-margin" style="margin-bottom: 0">
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
            <!-- {% include 'graphs/%s/clean-sheets-%s.html' % (params.team.names.hyphenated, params.team.names.hyphenated) %} -->
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

      <TeamsFooter lastUpdated={data.lastUpdated} />
    </div>
  {:else}
    <div class="loading-spinner-container">
      <div class="loading-spinner" />
    </div>
  {/if}
</Router>
