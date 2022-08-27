<script lang="ts">
  import SeasonComplete from "./SeasonComplete.svelte";

  function ordinal(n: number): string {
    let ord = [, "st", "nd", "rd"];
    let a = n % 100;
    return ord[a > 20 ? a % 10 : a] || "th";
  }

  function setOppTeam() {
    if (data.upcoming[team].nextTeam != null) {
      oppTeam = data.upcoming[team].nextTeam.toLowerCase().replace(/ /g, "-");
    }
  }

  let oppTeam: string;
  $: team && setOppTeam();

  export let data: TeamData,
    currentMatchday: string,
    team: string,
    showBadge: boolean,
    toAlias: Function,
    toInitials: Function,
    switchTeam: Function;
</script>

{#if data != undefined}
  {#if data.upcoming[team].nextTeam == null}
    <SeasonComplete {data} />
  {:else}
    <div
      class="next-game-prediction"
      style="border: 6px solid var(--{oppTeam});"
    >
      <div class="next-game-title" style="background-color: var(--{oppTeam});">
        <h1
          class="next-game-title-text"
          style="color: var(--{oppTeam}-secondary);"
        >
          Next Game:&nbsp
          <button
            on:click={() => {
              switchTeam(
                data.upcoming[team].nextTeam.toLowerCase().replace(/ /g, "-")
              );
            }}
            class="next-game-team-btn"
            >{toAlias(data.upcoming[team].nextTeam)}&nbsp</button
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
                {data.standings[data.upcoming[team].nextTeam][data._id]
                  .position}<span class="ordinal-position"
                  >{ordinal(
                    data.standings[data.upcoming[team].nextTeam][data._id]
                      .position
                  )}</span
                >
              </div>
            </div>
            <div class="next-game-item current-form">
              Current form:
              {#if currentMatchday != null}
                  <span class="current-form-value">{(
                    data.form[data._id][data.upcoming[team].nextTeam][
                      currentMatchday
                    ].formRating5 * 100
                  ).toFixed(1)}%</span
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
            </div>
          </div>
        </div>
        <div class="past-results">
          {#if data.upcoming[team].prevMatches.length == 0}
            <div class="next-game-item prev-results-title no-prev-results">
              No Previous Results
            </div>
          {:else}
            <div class="next-game-item prev-results-title">
              Previous Results
            </div>
          {/if}

          <!-- Display table of previous results against the next team this team is playing -->
          {#each data.upcoming[team].prevMatches as prevMatch}
            <div class="next-game-item-container">
              <div class="past-result-date {prevMatch.result}">
                {new Date(prevMatch.date).toLocaleDateString("en-GB", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </div>
              <div class="next-game-item {prevMatch.result}">
                <div class="past-result">
                  <div
                    class="home-team"
                    style="background: var(--{prevMatch.homeTeam
                      .toLowerCase()
                      .replace(/ /g, '-')}); color: var(--{prevMatch.homeTeam
                      .toLowerCase()
                      .replace(/ /g, '-')}-secondary)"
                  >
                    {toInitials(prevMatch.homeTeam)}
                  </div>
                  <div class="score">
                    {prevMatch.homeGoals} - {prevMatch.awayGoals}
                  </div>
                  <div
                    class="away-team"
                    style="background: var(--{prevMatch.awayTeam
                      .toLowerCase()
                      .replace(/ /g, '-')}); color: var(--{prevMatch.awayTeam
                      .toLowerCase()
                      .replace(/ /g, '-')}-secondary)"
                  >
                    {toInitials(prevMatch.awayTeam)}
                  </div>
                </div>
                <div style="clear: both" />
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
{/if}

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
    font-size: 1.4em;
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
    padding: 20px 0 40px;
    margin: auto 0;
  }

  .next-game-prediction {
    border-radius: var(--border-radius);
    min-height: 97.5%;
  }

  .next-game-values {
    display: flex;
    margin-right: 5%;
    min-height: 387px;
  }

  .next-game-position {
    font-size: 3.3em;
    font-weight: 700;
  }
  .ordinal-position {
    font-size: 0.6em;
  }

  .past-result {
    font-size: 15px;
    display: flex;
  }

  .past-result-date {
    font-size: 13px;
    color: #333;
    width: 120px;
    margin: 8px auto -5px;
    padding-top: 3px;
    border-radius: 4px 4px 0 0;
  }

  .prev-results-title {
    font-weight: 700;
    padding-top: 0;
    margin: 0 !important;
  }
  .no-prev-results {
    background: grey;
    display: grid;
    place-items: center;
    background: #f3f3f3;
    border: rgb(181, 181, 181) solid 5px;
    color: rgb(181, 181, 181);
    border-radius: var(--border-radius);
    padding: 100px 0;
    /* margin: 0 25px !important; */
  }
  .next-game-item {
    border-radius: var(--border-radius);
  }

  .won,
  .drew,
  .lost {
    color: #333
  }

  .won {
    background: rgb(169, 247, 169);
    background: #77dd77;
    background: #00fe87;
  }
  .drew {
    background: rgb(255, 207, 138);
    background: #ffb347;
    background: #ffdd00;
  }
  .lost {
    background: #f77979;
    background: #c23b22;
    background: #f83027;
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
    text-align: left;
    border-radius: var(--border-radius) 0 0 var(--border-radius);
  }

  .score {
    float: left;
    min-width: 44px;
    margin: 0 4px;
    text-align: center;
    font-weight: 800;
    flex: 3;
    margin-top: 3px;
    color: #333;
    align-self: center;
  }

  .away-team {
    float: left;
    text-align: right;
    border-radius: 0 var(--border-radius) var(--border-radius) 0;
  }

  .home-team,
  .away-team {
    font-size: 15px;
    width: calc(50% - 18px);
    padding: 5px 0 3px;
    flex: 1;
    text-align: center;
  }

  .next-game-team-btn {
    color: inherit;
    text-align: left;
  }

  .current-form {
    border-radius: 6px;
    padding: 10px 15px;
    color: white;
    background: #38003d;
    width: fit-content;
    margin: auto auto 10px;
  }
  .current-form-value {
    color: #00fe87;
  }

  @media only screen and (max-width: 1100px) {
    .next-game-prediction {
      margin: 50px 20px 40px;
    }
    .next-game-values {
      margin: 1% 8% 2% 0;
      min-height: auto;
    }
  }

  @media only screen and (max-width: 800px) {
    .next-game-prediction {
      margin: 50px 75px 40px;
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
      padding: 0;
    }

    .next-game-prediction {
      padding-bottom: 0;
    }
    .next-game-title-text {
      flex-direction: column;
      text-align: left;
    }

    .next-game-title {
      padding: 6px 15px;
    }
  }
  @media only screen and (max-width: 700px) {
    .next-game-prediction {
      margin: 40px 20px;
    }
  }
  @media only screen and (max-width: 550px) {
    .next-game-values {
      margin: 25px 10px 10px;
      font-size: 0.85em;
    }
    .next-game-prediction {
      margin: 40px 15px;
    }
  }
</style>
