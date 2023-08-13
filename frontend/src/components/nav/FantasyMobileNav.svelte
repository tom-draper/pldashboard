<script lang="ts">
  import {toHyphenatedName} from "../../lib/team";

  function switchTeamToTop(team: string) {
    switchPage(team);
    window.scrollTo(0, 0);
    toggleMobileNav();
  }

  function getHyphenatedTeamNames() {
    let hyphenatedTeamNames = [];
    for (let i = 0; i < pages.length; i++) {
      let teamLink = toHyphenatedName(pages[i]);
      if (teamLink != current_page) {
        hyphenatedTeamNames.push(teamLink);
      } else {
        hyphenatedTeamNames.push(null); // To keep teams and teamLinks list same length
      }
    }
    hyphenatedTeams = hyphenatedTeamNames;
  }

  let hyphenatedTeams: string[];
  //@ts-ignore
  $: current_page && (pages.length > 0) && getHyphenatedTeamNames();

  export let current_page: string,
    pages: string[],
    switchPage: Function,
    toggleMobileNav: Function;
</script>

<nav id="mobileNav" style="width: 0px">
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
              class="team-link first-team">{pages[i]}</button
            >
          {:else if i === hyphenatedTeams.length - 1 || (i === hyphenatedTeams.length - 2 && hyphenatedTeams[hyphenatedTeams.length - 1] === null)}
            <!-- Button with last-team class -->
            <button
              on:click={() => {
                switchTeamToTop(hyphenatedTeams[i]);
              }}
              class="team-link last-team">{pages[i]}</button
            >
          {:else}
            <button
              on:click={() => {
                switchTeamToTop(team);
              }}
              class="team-link">{pages[i]}</button
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
      width: 0px;
    }

    to {
      width: 100%;
    }
  }
</style>
