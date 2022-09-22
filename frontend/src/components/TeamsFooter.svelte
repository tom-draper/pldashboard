<script lang="ts">
  export let lastUpdated: string;
</script>

<div class="teams-footer footer-text-colour">
  <!-- <a class="ko-fi" href="https://ko-fi.com/C0C069FOI" target="_blank">
    <img class="ko-fi-img" src="img/kofi.png" alt="" />
    <div class="ko-fi-text">Support Me</div>
  </a> -->
  <div class="teams-footer-bottom">
    <div class="version">pldashboard v2.0</div>
    {#if lastUpdated != null}
      <div class="last-updated">Last updated: {new Date(lastUpdated).toLocaleString()} UTC</div>
    {/if}
  </div>
</div>

<style scoped>
  .teams-footer {
    color: rgb(198, 198, 198);
    padding: 50px 0 4px;
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

  /* Kofi button */
  .ko-fi {
    width: fit-content;
    background: #ff5f5f;
    padding: 0.8em 1.8em;
    color: white;
    text-decoration: none;
    border-radius: 6px;
    display: flex;
    margin: auto;
  }
  .ko-fi-text {
    margin: auto 0;
    font-size: 1.05em;
  }
  .ko-fi-img {
    width: 2.2em;
    height: 2.2em;
    margin-right: 1em;
  }
  @media only screen and (max-width: 1300px) {
    .teams-footer {
      margin-bottom: 42px;
    }
  }
</style>
