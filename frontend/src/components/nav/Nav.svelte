<script lang="ts">
  function closeNavBar() {
    document.getElementById("navBar").style.display = "none";
    document.getElementById("dashboard").style.marginLeft = "0";
    window.dispatchEvent(new Event("resize")); // Snap plotly graphs to new width
  }
  function openNavBar() {
    document.getElementById("navBar").style.display = "block";
    document.getElementById("dashboard").style.marginLeft = "200px";
  }

  export let team: string,
    teams: string[],
    toAlias: Function,
    switchTeam: Function;
</script>

<nav id="navBar">
  <div class="title no-selection">
    <p>
      <span style="color: #00fe87">pl</span>dashboard
    </p>
  </div>
  <div class="team-links">
    {#each teams as _team, _ (_team)}
      {#if _team.toLowerCase().replace(/ /g, "-") == team}
        <a href="/{_team.toLowerCase().replace(/ /g, '-')}" class="team-link">
          <div
            class="this-team-name"
            style="color: var(--{_team
              .toLowerCase()
              .replace(/ /g, '-')}-secondary);
              background-color: var(--{_team.toLowerCase().replace(/ /g, '-')})"
          >
            {toAlias(_team)}
          </div>
        </a>
      {:else}
        <button
          class="team-link"
          on:click={() => {
            switchTeam(_team.toLowerCase().replace(/ /g, "-"));
          }}
        >
          <div class="team-name">
            {toAlias(_team)}
          </div>
        </button>
      {/if}
    {/each}
  </div>
  <div class="close">
    <button class="close-btn" on:click={closeNavBar}>
      <img src="img/arrow-bar-left.svg" alt="" />
    </button>
  </div>
</nav>

<style scoped>
  .title {
    color: white;
    font-size: 1.6em;
    height: 96px;
    display: grid;
    place-items: center;
  }
  .no-selection {
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
  }
  .team-links {
    font-size: 1em;
    color: white;
    display: grid;
  }
  button {
    background: none;
    color: inherit;
    border: none;
    padding: 0;
    font: inherit;
    cursor: pointer;
    outline: inherit;
    text-align: left;
  }
  .this-team-name,
  .team-name {
    padding: 0.4em 1em;
    color: #c600d8;
  }
  :hover.team-name {
    background: #2c002f;
  }
  nav {
    position: fixed;
    width: 220px;
    height: 100vh;
    background: #37003c;
    background: #38003d;
  }
  .close-btn {
    position: absolute;
    right: 0.9em;
    bottom: 0.6em;
    background: transparent;
    border: none;
    outline: none;
    padding-top: 0.3em;
    cursor: pointer;
  }

  @media only screen and (max-width: 1300px) {
    #navBar {
      display: none;
    }
  }
</style>
