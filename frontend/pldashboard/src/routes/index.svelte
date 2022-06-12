<script context="module" lang="ts">
  export const prerender = true;
</script>

<svelte:head>
  <title>Premier League</title>
  <meta name="description" content="Svelte demo app" />
</svelte:head>

<section>
  <div class="header">
    <a class="title main-link no-decoration" href="/">Premier League</a>
  </div>
  <div class="page-content">
    <div class="teams">
      <a
        href="/manchester-city"
        class="team-button"
        id="team-1"
        style="background-color: var(--manchester-city);"
      >
        <div class="main-link" style="color: var(--manchester-city-secondary);">
          Manchester City
        </div>
      </a>
      <a
        href="/manchester-united"
        class="team-button"
        id="team-2"
        style="background-color: var(--manchester-united);"
      >
        <div class="main-link" style="color: var(--manchester-united-secondary);">
          Manchester United
        </div>
      </a>
      <a
        href="/liverpool"
        class="team-button"
        id="team-3"
        style="background-color: var(--liverpool);"
      >
        <div class="main-link" style="color: var(--liverpool-secondary);">Liverpool</div>
      </a>
      <a href="/chelsea" class="team-button" id="team-4" style="background-color: var(--chelsea);">
        <div class="main-link" style="color: var(--chelsea-secondary);">Chelsea</div>
      </a>
      <a
        href="/leicester-city"
        class="team-button"
        id="team-5"
        style="background-color: var(--leicester-city);"
      >
        <div class="main-link" style="color: var(--leicester-city-secondary);">Leicester</div>
      </a>
      <a
        href="/west-ham-united"
        class="team-button"
        id="team-6"
        style="background-color: var(--west-ham-united);"
      >
        <div class="main-link" style="color: var(--west-ham-united-secondary);">West Ham</div>
      </a>
      <a
        href="/tottenham-hotspur"
        class="team-button"
        id="team-7"
        style="background-color: var(--tottenham-hotspur);"
      >
        <div class="main-link" style="color: var(--tottenham-hotspur-secondary);">Spurs</div>
      </a>
      <a href="/arsenal" class="team-button" id="team-8" style="background-color: var(--arsenal);">
        <div class="main-link" style="color: var(--arsenal-secondary);">Arsenal</div>
      </a>
      <a
        href="/leeds-united"
        class="team-button"
        id="team-9"
        style="background-color: var(--leeds-united);"
      >
        <div class="main-link" style="color: var(--leeds-united-secondary);">Leeds United</div>
      </a>
      <a href="/everton" class="team-button" id="team-10" style="background-color: var(--everton);">
        <div class="main-link" style="color: var(--everton-secondary);">Everton</div>
      </a>
      <a
        href="/aston-villa"
        class="team-button"
        id="team-11"
        style="background-color: var(--aston-villa);"
      >
        <div class="main-link" style="color: var(--aston-villa-secondary);">Aston Villa</div>
      </a>
      <a
        href="/newcastle-united"
        class="team-button"
        id="team-12"
        style="background-color: var(--newcastle-united);"
      >
        <div class="main-link" style="color: var(--newcastle-united-secondary);">Newcastle</div>
      </a>
      <a
        href="/wolverhampton-wanderers"
        class="team-button"
        id="team-13"
        style="background-color: var(--wolverhampton-wanderers);"
      >
        <div class="main-link" style="color: var(--wolverhampton-wanderers-secondary);">Wolves</div>
      </a>
      <a
        href="/crystal-palace"
        class="team-button"
        id="team-14"
        style="background-color: var(--crystal-palace);"
      >
        <div class="main-link" style="color: var(--crystal-palace-secondary);">Crystal Palace</div>
      </a>
      <a
        href="/southampton"
        class="team-button"
        id="team-15"
        style="background-color: var(--southampton);"
      >
        <div class="main-link" style="color: var(--southampton-secondary);">Southampton</div>
      </a>
      <a
        href="/brighton-and-hove-albion"
        class="team-button"
        id="team-16"
        style="background-color: var(--brighton-and-hove-albion);"
      >
        <div class="main-link" style="color: var(--brighton-and-hove-albion-secondary);">
          Brighton
        </div>
      </a>
      <a href="/burnley" class="team-button" id="team-17" style="background-color: var(--burnley);">
        <div class="main-link" style="color: var(--burnley-secondary);">Burnley</div>
      </a>
      <a
        href="/norwich-city"
        class="team-button"
        id="team-18"
        style="background-color: var(--norwich-city);"
      >
        <div class="main-link" style="color: var(--norwich-city-secondary);">Norwich City</div>
      </a>
      <a href="/watford" class="team-button" id="team-19" style="background-color: var(--watford);">
        <div class="main-link" style="color: var(--watford-secondary);">Watford</div>
      </a>
      <a
        href="/brentford"
        class="team-button"
        id="team-20"
        style="background-color: var(--brentford);"
      >
        <div class="main-link" style="color: var(--brentford-secondary);">Brentford</div>
      </a>
    </div>

    <!-- <div class="home-page-footer">
      <script>kofiwidget2.init('Support Me', '#d9534f', 'C0C069FOI');kofiwidget2.draw();</script>
    </div> -->
  </div>
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    flex: 1;
  }

  .main-link {
    font-size: 1.4em;
    font-weight: 600;
    color: #333;
    flex: auto;
    align-self: center;
    text-decoration: none;
    letter-spacing: -1px;
  }

  .teams {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    width: 80%;
    margin: 8px auto;
    box-shadow: 0 0 0.5em 0.1em rgba(0, 0, 0, 0.2);
    background-color: rgba(0, 0, 0, 0.1);
  }
  .team-button {
    text-align: center;
    font-size: 20px;
    text-decoration: none;
    display: flex;
    justify-content: center;
    align-content: center;
    height: 125px;
  }
  .main-link {
    margin: 10px;
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
  .title {
    font-size: 2.6em;
    font-weight: 600;
  }
  .header {
    padding: 30px 15px;
    text-align: center;
  }

  .page-content {
    display: flex;
    flex-direction: column;
    text-align: center;
    width: 100%;
  }
</style>
