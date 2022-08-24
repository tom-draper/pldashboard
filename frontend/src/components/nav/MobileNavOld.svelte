<script>
  function switchTeamToTop(team) {
    switchTeam(team);
    window.scrollTo(0, 0);
  }

  function getHyphenatedTeamNames() {
    let hyphenatedTeamNames = [];
    for (let i = 0; i < teams.length; i++) {
      let teamLink = teams[i].toLowerCase().replace(/ /g, "-");
      if (teamLink != hypenatedTeam) {
        hyphenatedTeamNames.push(teamLink);
      } else {
        hyphenatedTeamNames.push(null);  // To keep teams and teamLinks list same length
      }
    }
    hypenatedTeams = hyphenatedTeamNames;
  }

  let hypenatedTeams;
  $: hypenatedTeam & getHyphenatedTeamNames();

  export let hypenatedTeam, teams, toAlias, switchTeam;
</script>

<nav>
  {#if hypenatedTeams != undefined}
    <div class="nav-title">Other Teams</div>
    <div class="team-links">
      {#each hypenatedTeams as _hypenatedTeam, i}
        {#if _hypenatedTeam != null}
          {#if i == 0 || (i == 1 && hypenatedTeams[0] == null)}
            <!-- Button with first-team class -->
            <button
              on:click={() => {
                switchTeamToTop(hypenatedTeams[i]);
              }}
              style="color: var(--{hypenatedTeams[i]}-secondary);
            background-color: var(--{hypenatedTeams[i]})"
              class="team-link first-team">{toAlias(teams[i])}</button
            >
          {:else if i == hypenatedTeams.length - 1 || (i == hypenatedTeams.length-2 && hypenatedTeams[hypenatedTeams.length-1] == null)}
            <!-- Button with last-team class -->
            <button
              on:click={() => {
                switchTeamToTop(hypenatedTeams[i]);
              }}
              style="color: var(--{hypenatedTeams[i]}-secondary);
                background-color: var(--{hypenatedTeams[i]})"
              class="team-link last-team">{toAlias(teams[i])}</button
            >
          {:else}
            <button
              on:click={() => {
                switchTeamToTop(_hypenatedTeam);
              }}
              style="color: var(--{_hypenatedTeam}-secondary);
                  background-color: var(--{_hypenatedTeam})"
              class="team-link">{toAlias(teams[i])}</button
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
