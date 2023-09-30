<script lang="ts">
  export let lastUpdated: string;
</script>

<div class="teams-footer footer-text-colour">
  <div class="teams-footer-bottom">
    <a
      href="https://github.com/tom-draper/pldashboard"
      target="_blank"
      class="github"
    >
      <img src="/img/github.png" alt="GitHub" class="github-img" />
    </a>
    {#if lastUpdated != null}
      <div class="last-updated no-select">
        Last updated: {new Date(lastUpdated).toLocaleString()} UTC
      </div>
    {/if}
    <a href="https://pldashboard.com/home" class="version no-select"
      ><span class="pl">pl</span>dashboard</a
    >
  </div>
</div>

<style scoped>
  .github {
    opacity: 0.3;
    margin-bottom: 1.5em;
    width: fit-content;
    place-self: center;
  }
  .github-img {
    width: 30px;
  }
  .teams-footer {
    color: #c6c6c6;
    padding: 1em 0 0.2em;
    height: auto;
    width: 100%;
    font-size: 13px;
    align-items: center;
  }
  .footer-text-colour {
    color: rgb(0 0 0 / 37%);
  }
  .teams-footer-bottom {
    margin: 30px 0;
    display: grid;
  }
  .version {
    margin: 10px auto;
    color: white;
    background: var(--purple);
    padding: 6px 10px;
    border-radius: 4px;
    width: fit-content;
  }
  .last-updated {
    text-align: center;
    margin-bottom: 1.5em;
  }
  .no-select {
    -webkit-touch-callout: none; /* iOS Safari */
    -webkit-user-select: none; /* Safari */
    -khtml-user-select: none; /* Konqueror HTML */
    -moz-user-select: none; /* Old versions of Firefox */
    -ms-user-select: none; /* Internet Explorer/Edge */
    user-select: none; /* Non-prefixed version, currently
                                    supported by Chrome, Edge, Opera and Firefox */
  }
  .pl {
    color: #00ef87;
  }

  @media only screen and (max-width: 1200px) {
    .teams-footer {
      margin-bottom: 46px;
    }
  }
</style>
