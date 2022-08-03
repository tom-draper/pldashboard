<script>
  function getAlias(team) {
    if (team in alias) {
      return alias[team];
    }
    return team;
  }
  export let team, teams, alias;
</script>

<nav>
  <div class="nav-title">Other teams</div>
  <div class="team-links">
    {#each teams as _team}
      {#if _team.toLowerCase().replace(/ /g, "-") != team}
        <div
          class="team-link-container"
          style="color: var(--{_team
            .toLowerCase()
            .replace(/ /g, '-')}-secondary);
              background-color: var(--{_team.toLowerCase().replace(/ /g, '-')})"
        >
          <a href="/{_team}" class="team-link">{getAlias(_team)}</a>
        </div>
      {/if}
    {/each}
  </div>
</nav>

<style scoped>
  .nav-title {
    font-size: 1.4em;
    margin-bottom: 0.8em;
  }
  nav {
    display: none;
    margin: 40px 8%;
  }
  .team-link-container {
    padding: 0.2em 0;
    margin: 0 auto;
    width: 100%;
  }
  .team-links {
    display: grid;
  }
  .team-link {
    color: inherit;
    background: inherit;
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
