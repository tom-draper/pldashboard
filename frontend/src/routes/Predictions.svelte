<script>
  import { Router, Link } from "svelte-routing";
  import { onMount } from "svelte";

  async function fetchData(address) {
    const response = await fetch(address);
    let json = await response.json();
    return json;
  }

  function toggleDetailsDisplay(id) {
    let prediction = document.getElementById(id);
    if (prediction != null) {
      prediction.classList.toggle("expanded");
    }
  }

  function identicalScore(prediction, actual) {
    return (
      Math.round(prediction.homeGoals) == actual.homeGoals &&
      Math.round(prediction.awayGoals) == actual.awayGoals
    );
  }

  function sameResult(prediction, actual) {
    return (
      (prediction.homeGoals > prediction.awayGoals &&
        actual.homeGoals > actual.awayGoals) ||
      (prediction.homeGoals == prediction.awayGoals &&
        actual.homeGoals == actual.awayGoals) ||
      (prediction.homeGoals < prediction.awayGoals &&
        actual.homeGoals < actual.awayGoals)
    );
  }

  function insertColours(json) {
    for (let i = 0; i < json.predictions.length; i++) {
      for (let j = 0; j < json.predictions[i].predictions.length; j++) {
        let prediction = json.predictions[i].predictions[j];
        if (prediction.actual != null) {
          if (identicalScore(prediction.prediction, prediction.actual)) {
            prediction.colour = "green";
          } else if (sameResult(prediction.prediction, prediction.actual)) {
            prediction.colour = "yellow";
          } else {
            prediction.colour = "red";
          }
        }
      }
    }
  }

  function datetimeToTime(datetime) {
    let date = new Date(datetime);
    date = date.toTimeString().slice(0, 5);
    return date;
  }

  function sortByDate(json) {
    json.predictions.sort((a, b) => {
      return new Date(b._id) - new Date(a._id);
    });
    // Sort each day of predictions by time
    for (let i = 0; i < json.predictions.length; i++) {
      json.predictions[i].predictions.sort((a, b) => {
        return new Date(a._id) - new Date(b._id);
      });
    }
  }

  let data;
  onMount(() => {
    fetchData("http://127.0.0.1:5000/predictions").then((json) => {
    // fetchData("https://pldashboard.herokuapp.com/predictions").then((json) => {
      sortByDate(json);
      insertColours(json);
      console.log(json);
      data = json;
      console.log(data.predictions);
    });
  });
</script>

<svelte:head>
  <title>Predictions</title>
  <meta name="description" content="Premier League Statistics Dashboard" />
</svelte:head>

<Router>
  <div class="predictions-header">
    <Link
      class="predictions-title main-link"
      style="text-decoration: none"
      to="/predictions">Predictions</Link
    >
  </div>

  {#if data != undefined}
    <div class="page-content">
      <div class="accuracy-display">
        <div class="accuracy">
          <span class="accuracy-item">
            Predicting with accuracy: <b
              >{(data.accuracy.scoreAccuracy * 100).toFixed(2)}%</b
            ></span
          ><br />
          <div class="accuracy-item">
            General results accuracy: <b
              >{(data.accuracy.resultAccuracy * 100).toFixed(2)}%</b
            >
          </div>
        </div>
      </div>

      <div class="predictions-container">
        <div class="predictions">
          {#if data.predictions != null}
            {#each data.predictions as { _id, predictions }}
              <div class="date">
                {_id}
              </div>
              <div class="medium-predictions-divider" />
              <!-- Each prediction on this day -->
              {#each predictions as pred}
                <button
                  class="prediction-container {pred.colour}"
                  on:click={() => toggleDetailsDisplay(pred._id)}
                >
                  <div class="prediction prediction-item">
                    <div class="prediction-label">Predicted:</div>
                    <div class="prediction-value">
                      <div class="prediction-initials">{pred.home}</div>
                      <div class="prediction-score">
                        {Math.round(pred.prediction.homeGoals)} - {Math.round(
                          pred.prediction.awayGoals
                        )}
                      </div>
                      <div class="prediction-initials">{pred.away}</div>
                    </div>
                  </div>
                  {#if pred.actual != null}
                    <div class="actual prediction-item">
                      <div class="prediction-label">Actual:</div>
                      <div class="prediction-value">
                        <div class="prediction-initials">{pred.home}</div>
                        <div class="prediction-score">
                          {pred.actual.homeGoals} - {pred.actual.awayGoals}
                        </div>
                        <div class="prediction-initials">{pred.away}</div>
                      </div>
                    </div>
                  {:else}
                    <div class="prediction-time">
                      {datetimeToTime(pred.datetime)}
                    </div>
                  {/if}

                  <!-- Toggle to see detialed score -->
                  {#if pred.prediction != null}
                    <div class="prediction-details" id={pred._id}>
                      <div class="detailed-predicted-score">
                        <b
                          >{pred.prediction.homeGoals} - {pred.prediction
                            .awayGoals}</b
                        >
                      </div>
                    </div>
                  {/if}
                </button>
              {/each}
              <div class="predictions-gap" />
            {/each}
          {/if}
        </div>
      </div>
    </div>

    <div class="predictions-footer footer-text-colour">
      <div class="method-description">
        Predictions are calculated using previous results and then adjusting by
        recent form and home advantage.
      </div>
      <!-- <div class="last-updated">{data.lastUpdated} UTC</div> -->
    </div>
  {:else}
    <div class="loading-spinner-container">
      <div class="loading-spinner" />
    </div>
  {/if}
</Router>
