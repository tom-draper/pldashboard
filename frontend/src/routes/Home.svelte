<script lang="ts">
  import { Router } from "svelte-routing";
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
    background: linear-gradient(90deg, #00fbd6, #02efff);
    background: #00ff87;
    padding: 18px 0;
  }
  .dashboard-link {
    color: #37003d;
    background: #00ff87;
    background: linear-gradient(70deg, #00ff87, #02efff, #5e80ff);
    background: linear-gradient(30deg, #00ff87, #2bd2ff);
    background: linear-gradient(70deg, #00ff87, #2bd2ff, #5e80ff);
    background: #fc014e;
    background: linear-gradient(90deg, #00ff87, #00fbd6);
    background: rgb(5, 235, 235);
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
      0 0 30px 1px #00ff882c, 
      0 0 60px 2px #02eeff2c;
  }

  @media only screen and (max-width: 800px) {
    img {
      width: 90%;
    }
    .dashboard-link,
    .fantasy-link {
      font-size: 1.2em;
      margin: 10px 0;
      padding: 15px 0;
      width: 140px;
    }
    .dashboard-link {
      background: linear-gradient(180deg, #00ff87, #00fbd6);
    }
    .fantasy-link {
      background: linear-gradient(180deg, #00fbd6, #02efff);
    }
    .links {
      flex-direction: column;
    }
  }
  @media only screen and (max-width: 500px) {
    .dashboard-link,
    .fantasy-link {
      font-size: 1em;
    }
  }
</style>
