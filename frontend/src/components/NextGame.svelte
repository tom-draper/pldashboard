<script>
  import { onMount } from "svelte";

  import { Link } from "svelte-routing";

  let oppTeam;
  onMount(() => {
    if (data.upcoming[fullTeamName].nextTeam != null) {
      oppTeam = data.upcoming[fullTeamName].nextTeam
        .toLowerCase()
        .replace(/ /g, "-");
      console.log(oppTeam);
    }
  });

  export let data, currentMatchday, fullTeamName;
</script>

{#if data}
  {#if data.upcoming[fullTeamName].nextTeam == null}
    <div class="next-game-prediction row-graph">
      <div class="next-game-season-complete">
        <h1 class="next-game-title-text">
          {data.currentSeason}/{data.currentSeason + 1} SEASON COMPLETE
        </h1>
      </div>
    </div>
  {:else}
    <div
      class="next-game-prediction row-graph"
      style="border: 6px solid var(--{data.upcoming[fullTeamName].nextTeam
        .toLowerCase()
        .replace(/ /g, '-')});"
    >
      <div
        class="next-game-title"
        style="background-color: var(--{data.upcoming[fullTeamName].nextTeam
          .toLowerCase()
          .replace(/ /g, '-')});"
      >
        <h1
          class="next-game-title-text"
          style="color: var(--{data.upcoming[fullTeamName].nextTeam
            .toLowerCase()
            .replace(/ /g, '-')}-secondary);"
        >
          Next Game:&nbsp<Link
            to="/{data.upcoming[fullTeamName].nextTeam
              .toLowerCase()
              .replace(/ /g, '-')}"
            style="color: inherit"
            ><div class="no-decoration">
              {data.upcoming[fullTeamName].nextTeam}
            </div></Link
          ><span class="parenthesis">(</span>{data.upcoming[fullTeamName].atHome
            ? "Home"
            : "Away"}<span class="parenthesis">)</span>
        </h1>
      </div>

      <div class="next-game-values">
        <div class="predictions-and-logo">
          <div
            class="next-game-logo opposition-badge"
            style="background-image: url('{data.logoURLs[
              data.upcoming[fullTeamName].nextTeam
            ]}')"
          />
          <div class="predictions">
            <div class="next-game-item">
              Current form:
              {#if currentMatchday != null}
                <b
                  >{data.form[data.upcoming[fullTeamName].nextTeam][
                    currentMatchday
                  ].formRating5}%</b
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
                  >{Math.round(
                    data.upcoming[fullTeamName].prediction.homeGoals
                  )} - {Math.round(
                    data.upcoming[fullTeamName].prediction.awayGoals
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
          {#if data.upcoming[fullTeamName].prevMatches.length == 0}
            <div class="next-game-item prev-results-title">
              No Previous Results
            </div>
          {:else}
            <div class="next-game-item prev-results-title">
              Previous Results
            </div>
          {/if}

          <!-- Display table of previous results against the next team this team is playing -->
          {#each data.upcoming[fullTeamName].prevMatches as prevMatch}
            <div class="next-game-item {prevMatch.result}">
              <div class="past-result">
                <div class="home-team">{prevMatch.homeTeam}</div>
                <div class="score">
                  {prevMatch.homeGoals} - {prevMatch.awayGoals}
                </div>
                <div class="away-team">{prevMatch.awayTeam}</div>
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
  {/if}
{/if}
