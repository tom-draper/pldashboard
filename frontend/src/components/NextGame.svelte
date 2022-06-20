<script>
  import { onMount } from "svelte";

  import { Link } from "svelte-routing";

  let oppTeam;
  onMount(() => {
    if (data.upcoming[fullTeamName].nextTeam != null) {
      oppTeam = data.upcoming[fullTeamName].nextTeam
        .replace(" FC", "")
        .toLowerCase()
        .replace(/ /g, "-");
    }
  });

  export let data, currentMatchday, fullTeamName;
</script>

{#if data != undefined}
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
      style="border: 6px solid var(--{data.upcoming[fullTeamName].nextTeam});"
    >
      {#if oppTeam != undefined}
        <div
          class="next-game-title"
          style="background-color: var(--{oppTeam});"
        >
          <h1
            class="next-game-title-text"
            style="color: var(--{oppTeam}-secondary);"
          >
            Next Game:
            <Link to="/{oppTeam}">
              <div class="no-decoration" style="color: inherit">
                {data.upcoming[fullTeamName].nextTeam}
              </div>
            </Link><span class="parenthesis">(</span>{data.upcoming[
              fullTeamName
            ].atHome}<span class="parenthesis">)</span>
          </h1>
        </div>
      {/if}
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
            <b
              >{data.form[data.upcoming[fullTeamName].nextTeam][currentMatchday]
                .formRating5}%</b
            >
          </div>
          <div class="next-game-item">
            Score prediction
            <br />
            <a class="predictions-link" href="/predictions">
              <b>{data.upcoming.prediction.scoreline}</b>
            </a>
            <br />
            <span class="accuracy-item">
              Predicting with accuracy:
              <b>{data.upcoming.prediction[fullTeamName].accuracy}%</b></span
            ><br />
            <div class="accuracy-item">
              General results accuracy:
              <b>{data.upcoming.prediction[fullTeamName].resultsAccuracy}%</b>
            </div>
          </div>
        </div>
      </div>
      <div class="past-results">
        {#if data.upcoming[fullTeamName].previousMatches.length == 0}
          <div class="next-game-item prev-results-title">
            No Previous Results
          </div>
        {:else}
          <div class="next-game-item prev-results-title">Previous Results</div>
        {/if}

        <!-- Display table of previous results against the next team this team is playing -->
        {#each data.upcoming[fullTeamName].previousMatches as prevMatch}
          <div class="next-game-item {prevMatch.oppTeam}">
            <div class="past-result">
              <div class="home-team">{prevMatch.homeTeam}</div>
              <div class="score">
                {prevMatch.homeGoals} - {prevMatch.awayGoals}
              </div>
              <div class="away-team">{prevMatch.awayTeam}</div>
            </div>
            <div style="clear: both" />
            <div class="past-result-date">
              {prevMatch.date}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
{/if}
