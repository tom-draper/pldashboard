<script>
  function ordinal(n) {
    let ord = [, "st", "nd", "rd"];
    let a = n % 100;
    return n + (ord[a > 20 ? a % 10 : a] || "th");
  }

  function setOppTeam() {
    if (data.upcoming[team].nextTeam != null) {
      oppTeam = data.upcoming[team].nextTeam
        .toLowerCase()
        .replace(/ /g, "-");
    }
  }

  let oppTeam;
  $: team && setOppTeam();

  export let data, team, currentMatchday, showBadge, getAlias, switchTeam;
</script>

<div class="next-game-prediction" style="border: 6px solid var(--{oppTeam});">
  <div class="next-game-title" style="background-color: var(--{oppTeam});">
    <h1 class="next-game-title-text" style="color: var(--{oppTeam}-secondary);">
      Next Game:&nbsp
      <button
        on:click="{() => {switchTeam(data.upcoming[team].nextTeam
          .toLowerCase()
          .replace(/ /g, '-'))}}"
        style="color: inherit">{getAlias(data.upcoming[team].nextTeam)}&nbsp</button
      >
      ({data.upcoming[team].atHome ? "Home" : "Away"})
    </h1>
  </div>

  <div class="next-game-values">
    <div class="predictions-and-logo">
      {#if showBadge}
        <div
          class="next-game-logo opposition-badge"
          style="background-image: url('{data.logoURLs[
            data.upcoming[team].nextTeam
          ]}')"
        />
      {:else}
        <div class="next-game-position" />
      {/if}
      <div class="predictions">
        <div class="next-game-item">
          <div class="next-game-position">
            {ordinal(
              data.standings[data.upcoming[team].nextTeam][data._id]
                .position
            )}
          </div>
        </div>
        <div class="next-game-item">
          Current form:
          {#if currentMatchday != null}
            <b
              >{(data.form[data._id][data.upcoming[team].nextTeam][
                currentMatchday].formRating5 * 100).toFixed(1)}%</b
            >
          {:else}
            None
          {/if}
        </div>
        <div class="next-game-item">
          Score prediction
          <br />
          <a class="predictions-link" href="/predictions">
            <b
              >{Math.round(data.upcoming[team].prediction.homeGoals)} - {Math.round(
                data.upcoming[team].prediction.awayGoals
              )}</b
            >
          </a>
          <br />
          <!-- <span class="accuracy-item">
              Predicting with accuracy:
              <b>{data.upcoming[fullTeamName].prediction.accuracy}%</b></span
            ><br />
            <div class="accuracy-item">
              General results accuracy:
              <b>{data.upcoming[fullTeamName].prediction.resultsAccuracy}%</b>
            </div> -->
        </div>
      </div>
    </div>
    <div class="past-results">
      {#if data.upcoming[team].prevMatches.length == 0}
        <div class="next-game-item prev-results-title no-prev-results">
          No Previous Results
        </div>
      {:else}
        <div class="next-game-item prev-results-title">Previous Results</div>
      {/if}

      <!-- Display table of previous results against the next team this team is playing -->
      {#each data.upcoming[team].prevMatches as prevMatch}
        <div class="next-game-item {prevMatch.result}">
          <div class="past-result">
            <div class="home-team">{getAlias(prevMatch.homeTeam)}</div>
            <div class="score">
              {prevMatch.homeGoals} - {prevMatch.awayGoals}
            </div>
            <div class="away-team">{getAlias(prevMatch.awayTeam)}</div>
          </div>
          <div style="clear: both" />
          <div class="past-result-date">
            {new Date(prevMatch.date).toLocaleDateString("en-us", {
              weekday: "long",
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style scoped>
  .next-game-title {
    width: max-content;
    padding: 6px 20px;
    border-radius: 0 0 var(--border-radius) 0;
  }

  .next-game-season-complete {
    display: grid;
    place-items: center;
    background: #f3f3f3;
    border: rgb(181, 181, 181) solid 5px;
    border-radius: var(--border-radius);
    height: 98%;
  }

  .next-game-title-text {
    margin: 0;
    color: rgb(181, 181, 181);
    display: flex;
  }

  .next-game-logo {
    height: 225px;
    margin: 10px;
    background-repeat: no-repeat;
    background-size: contain;
    background-position: center;
  }

  .predictions-and-logo {
    font-size: 22px;
    width: 45%;
    margin: auto;
  }

  button {
    background: none;
    color: inherit;
    border: none;
    padding: 0;
    font: inherit;
    cursor: pointer;
    outline: inherit;
  }

  .predictions-link {
    text-decoration: none;
    color: #333;
  }

  .predictions-link:hover {
    color: rgb(120 120 120);
  }

  .past-results {
    font-size: 22px;
    width: 55%;
    display: flex;
    flex-direction: column;
    margin: auto 0;
  }

  .next-game-prediction {
    /* margin: 0 20px 0 0; */
    border-radius: var(--border-radius);
    min-height: 97.5%;
  }

  .next-game-values {
    display: flex;
    margin-right: 5%;
    min-height: 370px;
  }

  .next-game-position {
    font-size: 3em;
    font-weight: 700;
  }

  .past-result {
    font-size: 17px;
    display: flex;
    margin: 0 5% 2px;
  }

  .drew {
    background-color: rgb(255, 207, 139);
  }

  .won {
    background-color: rgb(169, 247, 169);
  }

  .lost {
    background-color: #f77979;
  }

  .past-result-date {
    font-size: 13px;
    color: #333;
  }

  .prev-results-title {
    font-weight: 700;
    padding-top: 0 !important;
    margin: 0 !important;
  }
  .no-prev-results {
    background: grey;
    padding: 60px 0 !important;
    display: grid;
    place-items: center;
    background: #f3f3f3;
    border: rgb(181, 181, 181) solid 5px;
    color: rgb(181, 181, 181);
    border-radius: var(--border-radius);
    margin: 0 25px !important;
  }
  .next-game-item {
    padding: 7px 0 4px;
    border-radius: var(--border-radius);
    margin-top: 4px;
  }

  .accuracy {
    margin-bottom: 30px;
  }

  .accuracy-item {
    font-size: 14px;
    color: rgb(120 120 120);
    margin-bottom: 5px;
  }

  .home-team {
    float: left;
    width: calc(50% - 18px);
    text-align: left;
  }

  .score {
    float: left;
    min-width: 44px;
    margin: 0 4px;
    text-align: center;
    font-weight: 800;
  }

  .away-team {
    float: left;
    width: calc(50% - 18px);
    text-align: right;
  }

  .home-team,
  .away-team {
    font-size: 16px;
  }

  @media only screen and (max-width: 1100px) {
    .next-game-prediction {
      margin: 50px 20px 0;
    }
    .next-game-values {
      margin: 5% 8% 5% 0;
    }
  }

  @media only screen and (max-width: 800px) {
    .next-game-prediction {
      margin: 50px 75px 0;
    }

    /* Change next game to column orientation */
    .next-game-values {
      flex-direction: column;
      margin: 20px;
    }

    .predictions-and-logo {
      margin: 0 auto;
      width: 100%;
    }

    .past-results {
      margin: 30px auto 0;
      width: 100%;
    }

    .next-game-prediction {
      padding-bottom: 0;
    }
    .next-game-title-text {
      flex-direction: column;
      text-align: left;
    }
  }
  @media only screen and (max-width: 700px) {
    .next-game-prediction {
      margin: 40px 20px;
    }
  }
  @media only screen and (max-width: 550px) {
    .next-game-values {
      margin: 20px 10px;
      font-size: 0.85em;
    }
    .next-game-prediction {
      margin: 40px 15px;
    }
    /* .score,
    .home-team,
    .away-team {
    } */
  }
</style>
