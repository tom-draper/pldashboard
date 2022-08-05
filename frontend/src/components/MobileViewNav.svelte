<script>
  function switchTeamToTop(team) {
    switchTeam(team);
    window.scrollTo(0, 0);
  }

  function getHyphenatedTeamNames(teams) {
    let hyphenatedTeamNames = [];
    for (let i = 0; i < teams.length; i++) {
      let teamLink = teams[i].toLowerCase().replace(/ /g, "-");
      if (teamLink != team) {
        hyphenatedTeamNames.push(teamLink);
      } else {
        hyphenatedTeamNames.push(null);  // To keep teams and teamLinks list same length
      }
    }
    _teams = hyphenatedTeamNames;
  }

  let _teams;
  $: team & getHyphenatedTeamNames(teams);

  export let team, teams, getAlias, switchTeam;
</script>

<nav>
  {#if _teams != undefined}
    <div class="nav-title">Other Teams</div>
    <div class="team-links">
      {#each _teams as _team, i}
        {#if _team != null}
          {#if i == 0 || (i == 1 && _teams[0] == null)}
            <!-- Button with first-team class -->
            <button
              on:click={() => {
                switchTeamToTop(_teams[i]);
              }}
              style="color: var(--{_teams[i]}-secondary);
            background-color: var(--{_teams[i]})"
              class="team-link first-team">{getAlias(teams[i])}</button
            >
          {:else if i == _teams.length - 1 || (i == _teams.length-2 && _teams[_teams.length-1] == null)}
            <!-- Button with last-team class -->
            <button
              on:click={() => {
                switchTeamToTop(_teams[i]);
              }}
              style="color: var(--{_teams[i]}-secondary);
                background-color: var(--{_teams[i]})"
              class="team-link last-team">{getAlias(teams[i])}</button
            >
          {:else}
            <button
              on:click={() => {
                switchTeamToTop(_team);
              }}
              style="color: var(--{_team}-secondary);
                  background-color: var(--{_team})"
              class="team-link">{getAlias(teams[i])}</button
            >
          {/if}
        {/if}
      {/each}
    </div>
  {/if}
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
    .first-team {
      border-radius: 6px 6px 0 0;
    }
    .last-team {
      border-radius: 0 0 6px 6px;
    }
  }
</style>
