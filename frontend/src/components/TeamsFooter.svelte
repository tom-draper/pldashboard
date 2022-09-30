<script lang="ts">
  export let lastUpdated: string;
</script>

<div class="teams-footer footer-text-colour">
  <div class="teams-footer-bottom">
    {#if lastUpdated != null}
      <div class="last-updated">Last updated: {new Date(lastUpdated).toLocaleString()} UTC</div>
    {/if}
    <div class="version">pldashboard v2.0</div>
  </div>
</div>

<style scoped>
  .teams-footer {
    color: rgb(198, 198, 198);
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
    margin: 10px 0;
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
