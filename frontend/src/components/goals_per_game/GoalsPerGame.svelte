<script>
  import { onMount } from "svelte";
  import GoalsScoredFreq from "./GoalsScoredFreq.svelte";
  import GoalsConcededFreq from "./GoalsConcededFreq.svelte";

  function avgGoalFrequencies(data) {
    let goalFreq = {};
    for (let team of data.teamNames) {
      for (let matchday of Object.keys(data.form[team])) {
        let score = data.form[team][matchday].score;
        if (score != null) {
          let [h, _, a] = score.split(" ");
          // Also collect opposition goals scored
          if (data.form[team][matchday].atHome) {
            if (h in goalFreq) {
              goalFreq[h] += 1;
            } else {
              goalFreq[h] = 1;
            }
            if (a in goalFreq) {
              goalFreq[a] += 1;
            } else {
              goalFreq[a] = 1;
            }
          }
        }
      }
    }

    // Divide by number of teams to get avg
    for (let goals of Object.keys(goalFreq)) {
      goalFreq[goals] /= 20;
    }

    return goalFreq;
  }

  function teamScoredFrequencies(data, team) {
    let goalFreq = {};
    for (let matchday of Object.keys(data.form[team])) {
      let score = data.form[team][matchday].score;
      if (score != null) {
        let [h, _, a] = score.split(" ");
        if (data.form[team][matchday].atHome) {
          if (h in goalFreq) {
            goalFreq[h] += 1;
          } else {
            goalFreq[h] = 1;
          }
        } else {
          if (a in goalFreq) {
            goalFreq[a] += 1;
          } else {
            goalFreq[a] = 1;
          }
        }
      }
    }

    return goalFreq;
  }

  function teamConcededFrequencies(data, team) {
    let goalFreq = {};
    for (let matchday of Object.keys(data.form[team])) {
      let score = data.form[team][matchday].score;
      if (score != null) {
        let [h, _, a] = score.split(" ");
        if (data.form[team][matchday].atHome) {
          if (a in goalFreq) {
            goalFreq[a] += 1;
          } else {
            goalFreq[a] = 1;
          }
        } else {
          if (h in goalFreq) {
            goalFreq[h] += 1;
          } else {
            goalFreq[h] = 1;
          }
        }
      }
    }

    return goalFreq;
  }

  let goalFreq, teamScoredFreq, teamConcededFreq;
  onMount(() => {
    goalFreq = avgGoalFrequencies(data);
    teamScoredFreq = teamScoredFrequencies(data, fullTeamName);
    teamConcededFreq = teamConcededFrequencies(data, fullTeamName);
  });

  export let data, fullTeamName;
</script>

<div class="two-graphs">
  <div class="graph freq-graph mini-graph">
    {#if teamScoredFreq != undefined}
      <GoalsScoredFreq {goalFreq} {teamScoredFreq} />
    {/if}
  </div>
  <div class="graph freq-graph mini-graphh">
    {#if teamConcededFreq != undefined}
      <GoalsConcededFreq {goalFreq} {teamConcededFreq} />
    {/if}
  </div>
</div>
