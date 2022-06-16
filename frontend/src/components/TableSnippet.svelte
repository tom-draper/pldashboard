<script>
  import { onMount } from "svelte";

  function tableSnippetRange(sortedTeams, fullTeamName) {
    let teamStandingsIdx = sortedTeams.indexOf(fullTeamName);

    let low = teamStandingsIdx - 3;
    let high = teamStandingsIdx + 4;
    if (low < 0) {
      let overflow = low;
      high -= overflow;
      low = 0;
    }
    if (high > sortedTeams.length - 1) {
      let overflow = high - sortedTeams.length;
      low -= overflow;
      high = sortedTeams.length;
    }

    return [low, high];
  }

  function getTableSnippet(data, fullTeamName) {
    let sortedTeams = Object.keys(data.standings).sort(function (teamA, teamB) {
      return (
        data.standings[teamB][data.currentSeason].points -
        data.standings[teamA][data.currentSeason].points
      );
    });

    let [low, high] = tableSnippetRange(sortedTeams, fullTeamName);

    let teamTableIdx;
    let rows = [];
    for (let i = low; i < high; i++) {
      if (sortedTeams[i] == fullTeamName) {
        teamTableIdx = i - low;
      }
      rows.push({
        name: sortedTeams[i],
        position: data.standings[sortedTeams[i]][data.currentSeason].position,
        points: data.standings[sortedTeams[i]][data.currentSeason].points,
        gd: data.standings[sortedTeams[i]][data.currentSeason].gD,
      });
    }

    return {
      teamTableIdx: teamTableIdx,
      rows: rows,
    };
  }

  let tableSnippet;
  onMount(() => {
    tableSnippet = getTableSnippet(data, fullTeamName);
  });

  export let data, team, fullTeamName;
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

    {#each Array(tableSnippet.rows.length) as _, i}
      <!-- Divider -->
      {#if i == 0}
        {#if i != tableSnippet.teamTableIdx}
          <div id="divider" />
        {/if}
      {:else if i - 1 != tableSnippet.teamTableIdx && i != tableSnippet.teamTableIdx}
        <div id="divider" />
      {/if}

      <!-- Row of table -->
      {#if i == tableSnippet.teamTableIdx}
        <!-- Highlighted row for the team of the current page -->
        <div class="table-row this-team" style="background-color: var(--{team});">
          <div
            class="table-element table-position this-team"
            style="color: var(--{team}-secondary);"
          >
            {tableSnippet.rows[i].position}
          </div>
          <div
            class="table-element table-team-name this-team"
            style="color: var(--{team}-secondary);"
          >
            {tableSnippet.rows[i].name}
          </div>
          <div
            class="table-element table-gd this-team"
            style="color: var(--{team}-secondary);"
          >
            {tableSnippet.rows[i].gd}
          </div>
          <div
            class="table-element table-points this-team"
            style="color: var(--{team}-secondary);"
          >
            {tableSnippet.rows[i].points}
          </div>
        </div>
      {:else}
        <!-- Plain row -->
        <div class="table-row">
          <div class="table-element table-position">
            {tableSnippet.rows[i].position}
          </div>
          <div class="table-element table-team-name">
            {tableSnippet.rows[i].name}
          </div>
          <div class="table-element table-gd">
            {tableSnippet.rows[i].gd}
          </div>
          <div class="table-element table-points">
            {tableSnippet.rows[i].points}
          </div>
        </div>
      {/if}
    {/each}
    {#if tableSnippet.teamTableIdx != 6}
      <div id="divider" />
    {/if}
  {/if}
</div>
