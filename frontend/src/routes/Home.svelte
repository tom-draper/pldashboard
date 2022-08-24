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
      <img src="img/pldashboard4.png" alt="pldashboard" />
      <div class="links">
        <a class="dashboard-link" href="/">Dashboard</a>
        <a class="fantasy-link" href="/">Fantasy</a>
      </div>
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
  .fantasy-link {
    color: #37003d;
    background: linear-gradient(70deg, #00ff87, #02efff, #5e80ff);
    padding: 18px 0;
  }
  .dashboard-link {
    color: #37003d;
    background: #00ff87;
    padding: 18px 0;
  }
  .dashboard-link,
  .fantasy-link {
    font-size: 1.2em;
    border-radius: 5px;
    font-weight: bold;
    letter-spacing: 0.02em;
    margin: 0 20px;
    width: 160px;
    display: grid;
    place-items: center;
    box-shadow: 
      0 0 30px 1px #00ff8825, 
      0 0 60px 2px #02eeff23;
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
