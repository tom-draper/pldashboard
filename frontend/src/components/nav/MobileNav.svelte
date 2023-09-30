<script lang="ts">
  import { toHyphenatedName } from '../../lib/team';

  function switchTeamToTop(team: string) {
    switchTeam(team);
    window.scrollTo(0, 0);
    toggleMobileNav();
  }

  function getHyphenatedTeamNames() {
    const hyphenatedTeamNames = [];
    for (let i = 0; i < teams.length; i++) {
      const teamLink = toHyphenatedName(teams[i]);
      if (teamLink != hyphenatedTeam) {
        hyphenatedTeamNames.push(teamLink);
      } else {
        hyphenatedTeamNames.push(null); // To keep teams and teamLinks list same length
      }
    }
    hyphenatedTeams = hyphenatedTeamNames;
  }

  let hyphenatedTeams: string[];
  //@ts-ignore
  $: hyphenatedTeam && teams.length > 0 && getHyphenatedTeamNames();

  export let hyphenatedTeam: string,
    teams: string[],
    toAlias: (team: string) => void,
    switchTeam: (newTeam: string) => void,
    toggleMobileNav: () => void;
</script>

<nav id="mobileNav" style="width: 0%;">
  {#if hyphenatedTeams != undefined}
    <div class="team-links">
      {#each hyphenatedTeams as team, i}
        {#if team != null}
          {#if i === 0 || (i === 1 && hyphenatedTeams[0] === null)}
            <!-- Button with first-team class -->
            <button
              on:click={() => {
                switchTeamToTop(hyphenatedTeams[i]);
              }}
              style="color: var(--{hyphenatedTeams[i]}-secondary);
            background-color: var(--{hyphenatedTeams[i]})"
              class="team-link first-team">{toAlias(teams[i])}</button
            >
          {:else if i === hyphenatedTeams.length - 1 || (i === hyphenatedTeams.length - 2 && hyphenatedTeams[hyphenatedTeams.length - 1] === null)}
            <!-- Button with last-team class -->
            <button
              on:click={() => {
                switchTeamToTop(hyphenatedTeams[i]);
              }}
              style="color: var(--{hyphenatedTeams[i]}-secondary);
                background-color: var(--{hyphenatedTeams[i]})"
              class="team-link last-team">{toAlias(teams[i])}</button
            >
          {:else}
            <button
              on:click={() => {
                switchTeamToTop(team);
              }}
              style="color: var(--{team}-secondary);
                  background-color: var(--{team})"
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
    overflow: hidden;
    height: 100vh;
    animation: appear 0.1s ease-in 1;
    display: none;
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
  @keyframes appear {
    from {
      width: 0%;
    }
    to {
      width: 100%;
    }
  }
</style>
