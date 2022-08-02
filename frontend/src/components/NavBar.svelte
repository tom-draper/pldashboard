<script>

  let alias = {
    'Wolverhampton Wanderers': 'Wolves',
    'Tottenham Hotspur': 'Spurs',
    'Leeds United': 'Leeds',
    'West Ham United': 'West Ham',
    'Brighton and Hove Albion': 'Brighton'
  }

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

  function getAlias(team) {
    if (team in alias) {
      return alias[team]
    }
    return team
  }

  export let thisTeam;
</script>

<nav>
  <div class="title">pldashboard</div>
  <div class="team-links">
    <!-- <a href="/all-teams">
    <div class="all-teams">
      All Teams
    </div>
    </a> -->
    {#each teams as team, i (team)}
      {#if team.toLowerCase().replace(/ /g, "-") == thisTeam}
        <a href="/{team.toLowerCase().replace(/ /g, '-')}" class="team-link">
          <div
            class="team-name"
            style="color: var(--{team
              .toLowerCase()
              .replace(/ /g, '-')}-secondary);
              background-color: var(--{team.toLowerCase().replace(/ /g, '-')})"
          >
            {getAlias(team)}
          </div>
        </a>
      {:else}
        <a href="/{team.toLowerCase().replace(/ /g, '-')}" class="team-link">
          <div class="team-name">
            {getAlias(team)}
          </div>
        </a>
      {/if}
    {/each}
  </div>
</nav>

<style scoped>
  .title {
    color: white;
    font-size: 1.6em;
    /* padding: 1.5em 0.1em; */
    height: 102px;
    display: grid;
    place-items: center;
    /* text-align: center; */
  }
  .team-links {
    font-size: 1em;
    color: white;
  }
  /* .all-teams, */
  .team-name {
    padding: 0.5em 1em;
    color: #c600d8;
  }
  /* .all-teams {
    padding: 2em 0.8em;
  } */
  nav {
    position: fixed;
    width: 220px;
    height: 100vh;
    background: #37003c;
  }
</style>
