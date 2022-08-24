<script>
  function switchTeamToTop(team) {
    switchTeam(team);
    window.scrollTo(0, 0);
    toggleMobileNav();
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

  export let hypenatedTeam, teams, toAlias, switchTeam, toggleMobileNav;
</script>

<nav id="mobileNav" style="display: none">
  {#if hypenatedTeams != undefined}
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
  #mobileNav {
    position: fixed;
    z-index: 2;
    height: 100vh;
    width: 100%;
  }
  .team-links {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .team-link {
    color: inherit;
    background: inherit;
    cursor: pointer;
    border: none;
    font-size: 1em;
    padding: 0.4em;
    flex: 1;
  }
</style>
