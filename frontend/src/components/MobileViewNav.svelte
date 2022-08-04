<script>
  function switchTeamToTop(team) {
    switchTeam(team);
    window.scrollTo(0, 0);
  }

  export let team, teams, getAlias, switchTeam;
</script>

<nav>
  <div class="nav-title">Other Teams</div>
  <div class="team-links">
    {#each teams as _team}
      {#if _team.toLowerCase().replace(/ /g, "-") != team}
        <button
          on:click={() => {
            switchTeamToTop(_team.toLowerCase().replace(/ /g, "-"));
          }}
          style="color: var(--{_team
            .toLowerCase()
            .replace(/ /g, '-')}-secondary);
              background-color: var(--{_team.toLowerCase().replace(/ /g, '-')})"
          class="team-link">{getAlias(_team)}</button
        >
      {/if}
    {/each}
  </div>
</nav>

<style scoped>
  .nav-title {
    font-size: 1.4em;
    margin-bottom: 0.8em;
    font-weight: bold;
  }
  nav {
    display: none;
    margin: 40px 8%;
  }
  .team-links {
    display: grid;
  }
  .team-link {
    color: inherit;
    background: inherit;
    cursor: pointer;
    border: none;
    font-size: 1em;
    padding: 0.4em;
  }

  @media only screen and (max-width: 1300px) {
    nav {
      display: grid;
    }
    .team-links {
      grid-template-columns: repeat(5, 1fr);
    }
  }
  @media only screen and (max-width: 1150px) {
    .team-links {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  @media only screen and (max-width: 1000px) {
    nav {
      margin: 40px 5%;
    }
  }
  @media only screen and (max-width: 950px) {
    .team-links {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  @media only screen and (max-width: 750px) {
    .team-links {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media only screen and (max-width: 550px) {
    nav {
      margin: 20px auto;
      width: 80%;
    }

    .team-links {
      grid-template-columns: repeat(1, 1fr);
    }
  }
</style>
