<script>
  import { onMount } from "svelte";
  import GoalsScoredFreq from "./GoalsScoredFreq.svelte";
  import GoalsConcededFreq from "./GoalsConcededFreq.svelte";

  function avgBars() {
    return {
      x: Object.keys(goalFreq),
      y: Object.values(goalFreq),
      type: "bar",
      name: "Avg",
      marker: { color: "#C6C6C6" },
      line: { width: 0 },
      hovertemplate: "%{x} goals in %{y} games<extra></extra>",
      hoverinfo: "x+y",
    }
  }

  function teamBars(data, name, color) {
    return {
      x: Object.keys(data),
      y: Object.values(data),
      type: "bar",
      name: name,
      marker: { color: color },
      line: { width: 0 },
      hovertemplate: "%{x} goals in %{y} games<extra></extra>",
      hoverinfo: "x+y",
      opacity: 0.6,
    }
  }

  function bars(data, name, color) {
    return [
      avgBars(),
      teamBars(data, name, color)
    ]
  }

  function getConcededBars() {
    return bars(teamConcededFreq, "Goals conceded", "#C23B22")
  }

  function getScoredBars() {
    return bars(teamScoredFreq, "Goals scored", "#77DD77")
  }

  function getScoredTeamBars() {
    return teamBars(teamConcededFreq, "Goals conceded", "#C23B22")
  }

  function getConcededTeamBars() {
    return teamBars(teamScoredFreq, "Goals scored", "#77DD77")
  }


  function getXLabels() {
    return Object.keys(goalFreq);
  }

  function avgGoalFrequencies(data) {
    let goalFreq = {};
    for (let team of data.teamNames) {
      for (let matchday of Object.keys(data.form[data._id][team])) {
        let score = data.form[data._id][team][matchday].score;
        if (score != null) {
          let [h, _, a] = score.split(" ");
          // Also collect opposition goals scored
          if (data.form[data._id][team][matchday].atHome) {
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
    for (let matchday of Object.keys(data.form[data._id][team])) {
      let score = data.form[data._id][team][matchday].score;
      if (score != null) {
        let [h, _, a] = score.split(" ");
        if (data.form[data._id][team][matchday].atHome) {
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
    for (let matchday of Object.keys(data.form[data._id][team])) {
      let score = data.form[data._id][team][matchday].score;
      if (score != null) {
        let [h, _, a] = score.split(" ");
        if (data.form[data._id][team][matchday].atHome) {
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

  function refreshTeamData() {
    if (setup) {
      teamScoredFreq = teamScoredFrequencies(data, fullTeamName);
      teamConcededFreq = teamConcededFrequencies(data, fullTeamName);
    }
  }

  let goalFreq, teamScoredFreq, teamConcededFreq;
  let setup = false;
  onMount(() => {
    goalFreq = avgGoalFrequencies(data);
    teamScoredFreq = teamScoredFrequencies(data, fullTeamName);
    teamConcededFreq = teamConcededFrequencies(data, fullTeamName);
    setup = true;
  });

  $: fullTeamName && refreshTeamData();

  export let data, fullTeamName;
</script>

<div class="two-graphs">
  {#if setup}
  <div class="graph freq-graph mini-graph">
    <GoalsScoredFreq {fullTeamName} {getScoredBars} {getScoredTeamBars} {getXLabels} />
  </div>
  <div class="graph freq-graph mini-graphh">
    <GoalsConcededFreq {fullTeamName} {getConcededBars} {getConcededTeamBars} {getXLabels} />
  </div>
  {/if}
</div>
