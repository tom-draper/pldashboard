<script lang="ts">
  import { Router } from 'svelte-routing';
</script>

<svelte:head>
  <title>Premier League Dashboard</title>
  <meta name="description" content="Premier League Statistics Dashboard" />
</svelte:head>

<Router>
  <div id="home">
    <div class="content">
      <div id="circle" />
      <img src="img/pldashboard5.png" alt="pldashboard" />
      <div class="links">
        <a class="dashboard-link" href="/">Dashboard</a>
        <a class="fantasy-link" href="/fantasy">Fantasy</a>
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
    background-image: linear-gradient(to right, #025e4c45 1px, transparent 1px),
      linear-gradient(to bottom, #025e4c45 1px, transparent 1px);
    background-size: 80px 80px;
  }
  #circle {
    border-radius: 50%;
    width: 60vw;
    height: 28vw;
    z-index: 1;
    position: absolute;
    box-shadow: black 0 0 200px 100px;
  }

  .content {
    display: grid;
    place-items: center;
    margin-bottom: 100px;
  }
  img {
    z-index: 2;
    width: min(80%, 1000px);
    box-shadow: black 0px 0 70px 58px;
    box-shadow: black 0px 0 80px 80px;
  }
  .links {
    z-index: 3;
    display: flex;
    padding-top: 60px;
    background: black;
    box-shadow: black 0 60px 30px 30px;
  }
  .fantasy-link {
    color: #37003d;
    background: linear-gradient(70deg, var(--green), #02efff, #5e80ff);
    background: linear-gradient(90deg, #00fbd6, #02efff);
    background: var(--green);
    box-shadow: 0 0 30px 1px rgba(0, 254, 135, 0.2),
      0 0 60px 2px rgba(0, 254, 135, 0.2);
    padding: 18px 0;
  }
  .dashboard-link {
    color: #37003d;
    background: var(--green);
    background: linear-gradient(70deg, var(--green), #02efff, #5e80ff);
    background: linear-gradient(30deg, var(--green), #2bd2ff);
    background: linear-gradient(70deg, var(--green), #2bd2ff, #5e80ff);
    background: #fc014e;
    background: linear-gradient(90deg, var(--green), #00fbd6);
    background: rgb(5, 235, 235);
    box-shadow: 0 0 30px 1px rgba(5, 235, 235, 0.2),
      0 0 60px 2px rgba(5, 235, 235, 0.2);
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
    /* box-shadow: 0 0 30px 1px #00ff882c, 0 0 60px 2px #02eeff2c; */
  }

  @media only screen and (max-width: 800px) {
    img {
      width: 90%;
    }
    #circle {
      display: none;
    }
  }
  @media only screen and (max-width: 600px) {
    #home {
      background-size: 60px 60px;
    }
  }
  @media only screen and (max-width: 500px) {
    .links {
      flex-direction: column;
    }
    .dashboard-link,
    .fantasy-link {
      font-size: 14px;
      margin: 12px 0;
      padding: 18px 0;
      width: 140px;
    }
    img {
      box-shadow: black 0px 20px 30px 40px;
    }
    .links {
      box-shadow: black 0px 40px 30px 40px;
    }
  }
</style>
