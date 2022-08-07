<script>
  import { Router, Link } from "svelte-routing";
</script>

<svelte:head>
  <title>Premier League</title>
  <meta name="description" content="Premier League Statistics Dashboard" />
</svelte:head>

<Router>
  <div id="home">
    <div class="content">
      <img src="img/pldashboard4.png" alt="pldashboard">
      <div class="links">
        <div class="dashboard-link-container">
          <a class="dashboard-link" href="/">Dashboard</a>
        </div>
        <div class="fantasy-link-container">
          <a class="fantasy-link" href="/">FPL</a>
        </div>
      </div>
      <!-- <div class="donate">
        <a class="donate-link" href="/">Support me</a>
      </div> -->
    </div>
  </div>
</Router>

<style scoped>
  #home {
    background: black;
    min-height: 100vh;
    display: grid;
    place-items: center;
  }
  .content {
    display: grid;
    place-items: center;
    /* margin-top: 50px; */
    margin-bottom: 100px;
  }
  img {
    width: min(80%, 1000px);
  }
  .links {
    display: flex;
    margin-top: 20px;
  }
  .dashboard-link-container,
  .fantasy-link-container {
    margin: 2em 0;
  }
  .fantasy-link {
    color: #37003c;
    background: #00ff87;
    padding: 18px 58.5px
  }
  .dashboard-link {
    color: #00fe87;
    background: #38003d;
    padding: 18px 25px;
  }
  .dashboard-link,
  .fantasy-link {
    font-size: 1.2em;
    border-radius: 9px;
    font-weight: bold;
    letter-spacing: 0.02em;
    margin: 0 10px;
  }

  .donate {
    margin-top: 100px;
  }
  .donate-link {
    text-decoration: underline;
    color: rgb(90, 90, 90);
  }
  @media only screen and (max-width: 800px) {
    img {
      width: 90%;
    }
    .dashboard-link {
      padding: 20px 38.45px;
    }
    .dashboard-link,
    .fantasy-link {
      font-size: 1.2em;
    }
    .links {
      flex-direction: column;
    }
  }
  @media only screen and (max-width: 500px) {
    .fantasy-link {
      padding: 20px 66.7px;
    }
    .dashboard-link,
    .fantasy-link {
      font-size: 1em;
    }
  }
</style>
