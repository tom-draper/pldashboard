<script>
  import { Router, Link } from "svelte-routing";
  import { onMount } from "svelte";

  function removeBorderRadius() {
    document.getElementById("team-1").classList.remove("top-left");
    document.getElementById("team-1").classList.remove("top-right");
    document.getElementById("team-2").classList.remove("top-right");
    document.getElementById("team-4").classList.remove("top-right");
    document.getElementById("team-17").classList.remove("bottom-left");
    document.getElementById("team-18").classList.remove("bottom-left");
    document.getElementById("team-19").classList.remove("bottom-left");
    document.getElementById("team-20").classList.remove("bottom-left");
    document.getElementById("team-20").classList.remove("bottom-right");
  }

  function setBorderRadius() {
    let width = window.innerWidth;
    removeBorderRadius();
    if (width < 500) {
      // 20 rows of 1 column
      document.getElementById("team-1").classList.add("top-both");
      document.getElementById("team-20").classList.add("bottom-both");
    } else if (width < 1100) {
      // 10 rows of 2 columns
      document.getElementById("team-1").classList.add("top-left");
      document.getElementById("team-2").classList.add("top-right");
      document.getElementById("team-19").classList.add("bottom-left");
      document.getElementById("team-20").classList.add("bottom-right");
    } else {
      // 5 rows of 4 columns
      document.getElementById("team-1").classList.add("top-left");
      document.getElementById("team-4").classList.add("top-right");
      document.getElementById("team-17").classList.add("bottom-left");
      document.getElementById("team-20").classList.add("bottom-right");
    }
  }

  let teams = [
    "Manchester City",
    "Liverpool",
    "Chelsea",
    "Tottenham Hotspur",
    "Arsenal",
    "Manchester United",
    "West Ham United",
    "Leicester City",
    "Brighton and Hove Albion",
    "Wolverhampton Wanderers",
    "Newcastle United",
    "Crystal Palace",
    "Brentford",
    "Aston Villa",
    "Southampton",
    "Everton",
    "Leeds United",
    "Fulham",
    "Bournemouth",
    "Nottingham Forest",
  ];

  onMount(() => {
    window.addEventListener("resize", setBorderRadius, true);
    setBorderRadius();

    return () => {
      // Called when component is destroyed
      window.removeEventListener("resize", setBorderRadius, true);
    };
  });
</script>

<svelte:head>
  <title>Premier League</title>
  <meta name="description" content="Premier League Statistics Dashboard" />
</svelte:head>

<Router>
  <div class="header">
    <Link to="/">
      <div class="title main-link no-decoration">Premier League</div>
    </Link>
  </div>
  <div class="page-content">
    <div class="teams">
      {#each teams as team, i (team)}
        <Link
          to="/{team.toLowerCase().replace(/ /g, '-')}"
          class="team-button"
          id="team-{i + 1}"
          style="background-color: var(--{team
            .toLowerCase()
            .replace(/ /g, '-')});"
        >
          <div
            class="main-link"
            style="color: var(--{team
              .toLowerCase()
              .replace(/ /g, '-')}-secondary);"
          >
            {team}
          </div>
        </Link>
      {/each}
    </div>
  </div></Router
>

<style scoped>
  .teams {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    width: 80%;
    margin: 8px auto;
    box-shadow: 0 0 0.5em 0.1em rgba(0, 0, 0, 0.2);
    background-color: rgba(0, 0, 0, 0.1);
  }

  @media only screen and (max-width: 1250px) {
    .teams {
      width: 90%;
    }
  }

  @media only screen and (max-width: 1100px) {
    .teams {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media only screen and (max-width: 500px) {
    .teams {
      grid-template-columns: repeat(1, 1fr);
    }
  }
</style>
