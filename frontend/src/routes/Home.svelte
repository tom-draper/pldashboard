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

  onMount(() => {
    window.addEventListener("resize", setBorderRadius, true);
    setBorderRadius();
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
      <Link
        to="/manchester-city"
        class="team-button"
        id="team-1"
        style="background-color: var(--manchester-city);"
      >
        <div class="main-link" style="color: var(--manchester-city-secondary);">
          Manchester City
        </div>
      </Link>
      <Link
        to="/manchester-united"
        class="team-button"
        id="team-2"
        style="background-color: var(--manchester-united);"
      >
        <div
          class="main-link"
          style="color: var(--manchester-united-secondary);"
        >
          Manchester United
        </div>
      </Link>
      <Link
        to="/liverpool"
        class="team-button"
        id="team-3"
        style="background-color: var(--liverpool);"
      >
        <div class="main-link" style="color: var(--liverpool-secondary);">
          Liverpool
        </div>
      </Link>
      <Link
        to="/chelsea"
        class="team-button"
        id="team-4"
        style="background-color: var(--chelsea);"
      >
        <div class="main-link" style="color: var(--chelsea-secondary);">
          Chelsea
        </div>
      </Link>
      <Link
        to="/leicester-city"
        class="team-button"
        id="team-5"
        style="background-color: var(--leicester-city);"
      >
        <div class="main-link" style="color: var(--leicester-city-secondary);">
          Leicester
        </div>
      </Link>
      <Link
        to="/west-ham-united"
        class="team-button"
        id="team-6"
        style="background-color: var(--west-ham-united);"
      >
        <div class="main-link" style="color: var(--west-ham-united-secondary);">
          West Ham
        </div>
      </Link>
      <Link
        to="/tottenham-hotspur"
        class="team-button"
        id="team-7"
        style="background-color: var(--tottenham-hotspur);"
      >
        <div
          class="main-link"
          style="color: var(--tottenham-hotspur-secondary);"
        >
          Spurs
        </div>
      </Link>
      <Link
        to="/arsenal"
        class="team-button"
        id="team-8"
        style="background-color: var(--arsenal);"
      >
        <div class="main-link" style="color: var(--arsenal-secondary);">
          Arsenal
        </div>
      </Link>
      <a
        href="/leeds-united"
        class="team-button"
        id="team-9"
        style="background-color: var(--leeds-united);"
      >
        <div class="main-link" style="color: var(--leeds-united-secondary);">
          Leeds United
        </div>
      </a>
      <a
        href="/everton"
        class="team-button"
        id="team-10"
        style="background-color: var(--everton);"
      >
        <div class="main-link" style="color: var(--everton-secondary);">
          Everton
        </div>
      </a>
      <a
        href="/aston-villa"
        class="team-button"
        id="team-11"
        style="background-color: var(--aston-villa);"
      >
        <div class="main-link" style="color: var(--aston-villa-secondary);">
          Aston Villa
        </div>
      </a>
      <a
        href="/newcastle-united"
        class="team-button"
        id="team-12"
        style="background-color: var(--newcastle-united);"
      >
        <div
          class="main-link"
          style="color: var(--newcastle-united-secondary);"
        >
          Newcastle
        </div>
      </a>
      <a
        href="/wolverhampton-wanderers"
        class="team-button"
        id="team-13"
        style="background-color: var(--wolverhampton-wanderers);"
      >
        <div
          class="main-link"
          style="color: var(--wolverhampton-wanderers-secondary);"
        >
          Wolves
        </div>
      </a>
      <a
        href="/crystal-palace"
        class="team-button"
        id="team-14"
        style="background-color: var(--crystal-palace);"
      >
        <div class="main-link" style="color: var(--crystal-palace-secondary);">
          Crystal Palace
        </div>
      </a>
      <a
        href="/southampton"
        class="team-button"
        id="team-15"
        style="background-color: var(--southampton);"
      >
        <div class="main-link" style="color: var(--southampton-secondary);">
          Southampton
        </div>
      </a>
      <a
        href="/brighton-and-hove-albion"
        class="team-button"
        id="team-16"
        style="background-color: var(--brighton-and-hove-albion);"
      >
        <div
          class="main-link"
          style="color: var(--brighton-and-hove-albion-secondary);"
        >
          Brighton
        </div>
      </a>
      <a
        href="/burnley"
        class="team-button"
        id="team-17"
        style="background-color: var(--burnley);"
      >
        <div class="main-link" style="color: var(--burnley-secondary);">
          Burnley
        </div>
      </a>
      <a
        href="/norwich-city"
        class="team-button"
        id="team-18"
        style="background-color: var(--norwich-city);"
      >
        <div class="main-link" style="color: var(--norwich-city-secondary);">
          Norwich City
        </div>
      </a>
      <a
        href="/watford"
        class="team-button"
        id="team-19"
        style="background-color: var(--watford);"
      >
        <div class="main-link" style="color: var(--watford-secondary);">
          Watford
        </div>
      </a>
      <a
        href="/brentford"
        class="team-button"
        id="team-20"
        style="background-color: var(--brentford);"
      >
        <div class="main-link" style="color: var(--brentford-secondary);">
          Brentford
        </div>
      </a>
    </div>
  </div>
</Router>