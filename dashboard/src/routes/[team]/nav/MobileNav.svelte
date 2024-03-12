<script lang="ts">
  import { toHyphenatedName } from '../team';
  import { Team } from '../dashboard.types';
  import { toAlias } from '../team';

  function switchTeamToTop(team: Team) {
    switchTeam(team);
    window.scrollTo(0, 0);
    toggleMobileNav();
  }

  export let
    teams: Team[],
    switchTeam: (newTeam: Team) => void,
    toggleMobileNav: () => void;
</script>

<nav id="mobileNav" style="width: 0%;">
  <div class="team-links">
    {#each teams as team, i}
      {#if team != null}
        {#if i === 0 || (i === 1 && teams[0] === null)}
          <!-- Button with first-team class -->
          <button
            on:click={() => {
              switchTeamToTop(teams[i]);
            }}
            style="color: var(--{toHyphenatedName(team)}-secondary);
          background-color: var(--{toHyphenatedName(team)})"
            class="team-link first-team">{toAlias(teams[i])}</button
          >
        {:else if i === teams.length - 1 || (i === teams.length - 2 && teams[teams.length - 1] === null)}
          <!-- Button with last-team class -->
          <button
            on:click={() => {
              switchTeamToTop(team);
            }}
            style="color: var(--{toHyphenatedName(team)}-secondary);
              background-color: var(--{toHyphenatedName(team)})"
            class="team-link last-team">{toAlias(team)}</button
          >
        {:else}
          <button
            on:click={() => {
              switchTeamToTop(team);
            }}
            style="color: var(--{toHyphenatedName(team)}-secondary);
                background-color: var(--{team})"
            class="team-link">{toAlias(team)}</button
          >
        {/if}
      {/if}
    {/each}
  </div>
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
