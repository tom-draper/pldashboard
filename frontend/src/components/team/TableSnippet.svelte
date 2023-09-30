<script lang="ts">
  import type { DashboardData, Team } from '../../lib/dashboard.types';
  import { toAlias, toHyphenatedName } from '../../lib/team';

  function tableSnippetRange(
    sortedTeams: string[],
    team: string
  ): [number, number] {
    const teamStandingsIdx = sortedTeams.indexOf(team);

    let low = teamStandingsIdx - 3;
    let high = teamStandingsIdx + 4;
    if (low < 0) {
      const overflow = low;
      high -= overflow;
      low = 0;
    }
    if (high > sortedTeams.length - 1) {
      const overflow = high - sortedTeams.length;
      low -= overflow;
      high = sortedTeams.length;
    }

    return [low, high];
  }

  function buildTableSnippet() {
    const sortedTeams = Object.keys(data.standings).sort(function (
      teamA,
      teamB
    ) {
      return (
        data.standings[teamA][data._id].position -
        data.standings[teamB][data._id].position
      );
    });

    const [low, high] = tableSnippetRange(sortedTeams, team);

    let teamTableIdx: number;
    const rows = [];
    for (let i = low; i < high; i++) {
      if (sortedTeams[i] === team) {
        teamTableIdx = i - low;
      }
      rows.push({
        name: sortedTeams[i],
        position: data.standings[sortedTeams[i]][data._id].position,
        points: data.standings[sortedTeams[i]][data._id].points,
        gd: data.standings[sortedTeams[i]][data._id].gD,
      });
    }

    tableSnippet = {
      teamTableIdx: teamTableIdx,
      rows: rows,
    };
  }

  type TableSnippet = {
    teamTableIdx: number;
    rows: {
      name: Team;
      position: number;
      points: number;
      gd: number;
    }[];
  };

  let tableSnippet: TableSnippet;
  $: team && buildTableSnippet();

  export let data: DashboardData,
    hyphenatedTeam: string,
    team: Team,
    switchTeam: (newTeam: string) => void;
</script>

<div class="table-snippet">
  {#if tableSnippet != undefined}
    <div class="divider" />
    <div class="table-row">
      <div class="table-element table-position column-title" />
      <div class="table-element table-team-name column-title">Team</div>
      <div class="table-element table-gd column-title">GD</div>
      <div class="table-element table-points column-title">Points</div>
    </div>

    {#each tableSnippet.rows as row, i}
      <!-- Divider -->
      {#if i === 0}
        {#if i != tableSnippet.teamTableIdx}
          <div id="divider" />
        {/if}
      {:else if i - 1 != tableSnippet.teamTableIdx && i != tableSnippet.teamTableIdx}
        <div id="divider" />
      {/if}
      <!-- Row of table -->
      {#if i === tableSnippet.teamTableIdx}
        <!-- Highlighted row for the team of the current page -->
        <div
          class="table-row this-team"
          style="background-color: var(--{hyphenatedTeam});"
        >
          <div
            class="table-element table-position this-team"
            style="color: var(--{hyphenatedTeam}-secondary);"
          >
            {row.position}
          </div>
          <a
            href="/{hyphenatedTeam}"
            class="table-element table-team-name this-team"
            style="color: var(--{hyphenatedTeam}-secondary);"
          >
            {toAlias(row.name)}
          </a>
          <div
            class="table-element table-gd this-team"
            style="color: var(--{hyphenatedTeam}-secondary);"
          >
            {row.gd}
          </div>
          <div
            class="table-element table-points this-team"
            style="color: var(--{hyphenatedTeam}-secondary);"
          >
            {row.points}
          </div>
        </div>
      {:else}
        <!-- Plain row -->
        <div class="table-row">
          <div class="table-element table-position">
            {row.position}
          </div>
          <button
            on:click={() => {
              switchTeam(toHyphenatedName(row.name));
            }}
            class="table-element table-team-name"
          >
            {toAlias(row.name)}
          </button>
          <div class="table-element table-gd">
            {row.gd}
          </div>
          <div class="table-element table-points">
            {row.points}
          </div>
        </div>
      {/if}
    {/each}
    {#if tableSnippet.teamTableIdx != 6}
      <div id="divider" />
    {/if}
  {/if}
</div>

<style scoped>
  .table-snippet {
    position: relative;
    margin-top: 20px;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: auto;
  }
  .table-row {
    display: flex;
    padding: 5px 5%;
    border-radius: var(--border-radius);
  }
  .table-row.this-team {
    padding: 14px 5%;
    font-size: 20px;
  }
  .this-team {
    font-size: 1.1em !important;
  }
  #divider {
    align-self: center;
    border-bottom: 1px solid grey;
    width: 90%;
    margin: auto;
  }
  .column-title {
    font-weight: 700;
  }
  .table-position {
    width: 7%;
  }
  button {
    background: none;
    color: inherit;
    border: none;
    padding: 0;
    font: inherit;
    cursor: pointer;
    outline: inherit;
  }
  .table-team-name {
    width: 63%;
    text-align: left;
    margin-left: 8px;
    color: #333333;
  }
  .table-gd {
    width: 15%;
  }
  .table-points {
    width: 15%;
  }

  @media only screen and (max-width: 1100px) {
    .table-snippet {
      margin-top: 0;
    }
  }
  @media only screen and (max-width: 550px) {
    .table-snippet {
      font-size: 14px;
    }
  }
</style>
