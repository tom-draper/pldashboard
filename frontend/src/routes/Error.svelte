<script lang="ts">
  import { Router } from 'svelte-routing';
</script>

<svelte:head>
  <title>Premier League</title>
  <meta name="description" content="Premier League Statistics Dashboard" />
</svelte:head>

<Router>
  <div id="error">
    <div class="msg-container">Error: Page not found</div>
  </div>
</Router>

<style scoped>
  #error {
    display: grid;
    place-items: center;
    height: 75vh;
    background: #fafafa;
  }
  .msg-container {
    background: var(--purple);
    color: var(--green);
    border-radius: 6px;
    padding: 0.5em 1em 0.5em 1em;
    font-size: 2em;
  }

  @media only screen and (max-width: 600px) {
    #error {
      height: 85vh;
    }
    .msg-container {
      font-size: 1.5em;
    }
  }
</style>
