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

  function closeNavBar() {
    console.log("hi");
    document.getElementById('navBar').style.display = 'none';
    document.getElementById('dashboard').style.marginLeft = 0;
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
  <div class="close">
    <button class="close-btn" on:click="{closeNavBar}">
      <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="#c600d8" class="bi bi-arrow-bar-left" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M12.5 15a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 1 0v13a.5.5 0 0 1-.5.5zM10 8a.5.5 0 0 1-.5.5H3.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L3.707 7.5H9.5a.5.5 0 0 1 .5.5z"/>
    </svg>
    </button>
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
  .close-btn {
    position: absolute;
    right: 0.9em;
    bottom: 0.6em;
    /* background: #c600d8 !important; */
    background: #37003c;
    /* color: #c600d8 !important; */
    border: none;
    outline: none;
    padding-top: 0.3em;
    cursor: pointer;
  }
  /* .close-icon {
    width: 25px;
    height: 25px;
    color: red;
  } */
</style>
