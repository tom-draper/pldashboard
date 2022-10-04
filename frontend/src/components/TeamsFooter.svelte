<script lang="ts">
  export let lastUpdated: string;
</script>

<div class="teams-footer footer-text-colour">
  <div class="teams-footer-bottom">
    {#if lastUpdated != null}
      <div class="last-updated">Last updated: {new Date(lastUpdated).toLocaleString()} UTC</div>
    {/if}
    <div class="version"><span style="color:#00ff87">pl</span>dashboard</div>
  </div>
</div>

<style scoped>
  .teams-footer {
    /* color: rgb(198, 198, 198); */
    color: var(--purple);
    opacity: 0.35;
    padding: 1em 0 0.2em;
    height: auto;
    width: 100%;
    font-size: 13px;
    align-items: center;
  }
  .teams-footer-bottom {
    margin: 30px 0;
  }
  .version {
    margin: 10px auto;
    color: white;
    background: var(--purple);
    /* opacity: 0.5; */
    padding: 6px 10px;
    border-radius: 4px;
    width: fit-content;
  }
  .last-updated {
    text-align: center;
    margin-bottom: 1em;
  }

  @media only screen and (max-width: 1200px) {
    .teams-footer {
      margin-bottom: 46px;
    }
  }
</style>
