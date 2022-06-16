<script>
  export let lastUpdated;
</script>

<div class="teams-footer footer-text-colour">
  <a class="ko-fi" href="https://ko-fi.com/C0C069FOI" target="_blank">
    <img class="ko-fi-img" src="img/kofi.png" alt="" />
    <div class="ko-fi-text">Support Me</div>
  </a>
  <div class="teams-footer-bottom">
    {#if lastUpdated != null}
      <div class="last-updated">{lastUpdated} UTC</div>
    {/if}
    <div class="footer-details">
      <div class="footer-detail footer-text-colour">
        Data provided by
        <a
          class="footer-text-colour underline"
          href="https://www.football-data.org/">football-data.org</a
        >
      </div>
      <div class="footer-detail footer-text-colour">
        Graphs created using
        <a class="footer-text-colour underline" href="https://plotly.com/"
          >Plotly</a
        >
      </div>
      <div class="footer-detail footer-text-colour">
        Font made from
        <a class="footer-text-colour" href="http://www.onlinewebfonts.com"
          >oNline Web Fonts</a
        >
        is licensed by CC BY 3.0
      </div>
    </div>
    <div class="footer-bottom">
      <div class="created-by footer-text-colour">Created by Tom Draper</div>
      <div class="version footer-text-colour">v2.0</div>
    </div>
  </div>
</div>
