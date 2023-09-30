<script lang="ts">
  function switchTeamToTop(page: string) {
    switchPage(page);
    window.scrollTo(0, 0);
    toggleMobileNav();
  }

  export let pages: string[],
    switchPage: (page: string) => void,
    toggleMobileNav: () => void;
</script>

<nav id="mobileNav" style="width: 0%;">
  {#if pages != undefined}
    <div class="team-links">
      {#each pages as page, i}
        <button
          on:click={() => {
            switchTeamToTop(page);
          }}
          class="team-link {page.toLowerCase()}"
          >{pages[i][0].toUpperCase() + pages[i].slice(1)}</button
        >
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
    color: #1c0d2d;
    background: #00fe87;
  }
  .attack {
    background: var(--pink);
  }
  .defence {
    background: #2dbaff;
  }
  .goalkeeper {
    background: #280936;
    color: white;
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
