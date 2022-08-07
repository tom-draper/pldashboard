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
      hovertemplate: `Average %{x} with probability %{y:.2f}<extra></extra>`,
      hoverinfo: "x+y",
    };
  }
  
  function teamBars(data, type, color) {
    let opener = 'Score'
    if (type == 'conceded') {
      opener = 'Concede'
    }
    return {
      x: Object.keys(data),
      y: Object.values(data),
      type: "bar",
      name: `Goals ${type}`,
      marker: { color: color },
      hovertemplate: `${opener} %{x} with probability %{y:.2f}<extra></extra>`,
      // marker: { color: color },
      line: { width: 0 },
      hoverinfo: "x+y",
      opacity: 0.6,
    };
  }

  function bars(data, name, color) {
    return [avgBars(), teamBars(data, name, color)];
  }

  // Basic colour scale shared between the two bar chars
  let colourScale = ["#5df455", "#b2d000", "#dfa700", "#f77a1c", "#f74d4d"];

  // Concatenate unique extreme colours, for extreme values that only a few teams achieve
  // Concatenate bright greens
  let scoredColourScale = reversed(colourScale).concat([
    "#4EF745",
    "#3BFA31",
    "#1bfd0f",
  ]);
  // Concatenate bright reds
  let concededColourScale = colourScale.concat([
    "#FA3E3C",
    "#FC2B29",
    "#FD0F0F",
  ]);

  function reversed(arr) {
    return arr.slice().reverse();
  }

  function getScoredBars() {
    // return bars(teamScoredFreq, "Goals scored", "#77DD77");
    return bars(teamScoredFreq, "scored", scoredColourScale);
  }

  function getConcededBars() {
    return bars(teamConcededFreq, "conceded", concededColourScale);
  }

  function getScoredTeamBars() {
    return teamBars(teamScoredFreq, "scored", scoredColourScale);
  }

  function getConcededTeamBars() {
    return teamBars(teamConcededFreq, "conceded", concededColourScale);
  }

  function getXLabels() {
    return Object.keys(goalFreq);
  }

  function getYAxisLayout() {
    return {
      title: { text: "Probability" },
      gridcolor: "gray",
      showgrid: false,
      showline: false,
      zeroline: false,
      fixedrange: true,
      autorange: false,
      range: [0, maxY],
    };
  }

  function countScored(data, goalFreq, season, team) {
    if (!(team in data.form[season])) {
      return;
    }

    for (let matchday of Object.keys(data.form[season][team])) {
      let score = data.form[season][team][matchday].score;
      if (score != null) {
        let [h, _, a] = score.split(" ");
        if (data.form[season][team][matchday].atHome) {
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
  }

  function avgGoalFrequencies(data) {
    let goalFreq = {};
    for (let team of data.teamNames) {
      countScored(data, goalFreq, data._id, team);
      countScored(data, goalFreq, data._id - 1, team);
    }

    // Divide by number of teams to get avg
    for (let goals of Object.keys(goalFreq)) {
      goalFreq[goals] /= 20;
    }

    return goalFreq;
  }

  function teamScoredFrequencies(data, team) {
    let goalFreq = {};
    countScored(data, goalFreq, data._id, team);
    countScored(data, goalFreq, data._id - 1, team);

    return goalFreq;
  }

  function countConceded(data, goalFreq, season, team) {
    if (!(team in data.form[season])) {
      return;
    }

    for (let matchday of Object.keys(data.form[season][team])) {
      let score = data.form[season][team][matchday].score;
      if (score != null) {
        let [h, _, a] = score.split(" ");
        if (data.form[season][team][matchday].atHome) {
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
  }

  function teamConcededFrequencies(data, team) {
    let goalFreq = {};
    countConceded(data, goalFreq, data._id, team);
    countConceded(data, goalFreq, data._id - 1, team);

    return goalFreq;
  }

  function checkForMax(freq, max) {
    for (let goals of Object.values(freq)) {
      if (goals > max) {
        max = goals;
      }
    }
    return max;
  }

  function maxValue(goalFreq, teamScoredFreq, teamConcededFreq) {
    let max = 0;
    max = checkForMax(goalFreq, max);
    max = checkForMax(teamScoredFreq, max);
    max = checkForMax(teamConcededFreq, max);
    return max;
  }

  function valueSum(obj) {
    let total = 0;
    for (let freq in obj) {
      total += obj[freq];
    }
    return total;
  }

  function scaleTeamFreq(goalFreq, teamScoredFreq, teamConcededFreq) {
    let totalGoalFreq = valueSum(goalFreq);

    let totalTeamScoredFreq = valueSum(teamScoredFreq);
    for (let goals in teamScoredFreq) {
      teamScoredFreq[goals] *= totalGoalFreq / totalTeamScoredFreq;
    }

    let totalTeamConcededFreq = valueSum(teamConcededFreq);
    for (let goals in teamConcededFreq) {
      teamConcededFreq[goals] *= totalGoalFreq / totalTeamConcededFreq;
    }
  }

  function convertToPercentage(freq) {
    let totalFreq = valueSum(freq);
    for (let goals in freq) {
      freq[goals] /= totalFreq;
    }
  }

  function convertAllToPercentage(goalFreq, teamScoredFreq, teamConcededFreq) {
    convertToPercentage(goalFreq);
    convertToPercentage(teamScoredFreq);
    convertToPercentage(teamConcededFreq);
  }

  function refreshTeamData() {
    if (setup) {
      teamScoredFreq = teamScoredFrequencies(data, team);
      teamConcededFreq = teamConcededFrequencies(data, team);
      scaleTeamFreq(goalFreq, teamScoredFreq, teamConcededFreq);
      convertToPercentage(teamScoredFreq);
      convertToPercentage(teamConcededFreq);
      maxY = maxValue(goalFreq, teamScoredFreq, teamConcededFreq);
    }
  }

  let goalFreq, teamScoredFreq, teamConcededFreq, maxY;
  let setup = false;
  onMount(() => {
    goalFreq = avgGoalFrequencies(data);
    teamScoredFreq = teamScoredFrequencies(data, team);
    teamConcededFreq = teamConcededFrequencies(data, team);
    scaleTeamFreq(goalFreq, teamScoredFreq, teamConcededFreq);
    convertAllToPercentage(goalFreq, teamScoredFreq, teamConcededFreq);
    maxY = maxValue(goalFreq, teamScoredFreq, teamConcededFreq);
    setup = true;
  });

  $: team && refreshTeamData();

  export let data, team;
</script>

<div class="two-graphs">
  {#if setup}
    <div class="graph freq-graph mini-graph">
      <GoalsScoredFreq
        {team}
        {getScoredBars}
        {getScoredTeamBars}
        {getXLabels}
        {getYAxisLayout}
      />
    </div>
    <div class="graph freq-graph mini-graphh">
      <GoalsConcededFreq
        {team}
        {getConcededBars}
        {getConcededTeamBars}
        {getXLabels}
        {getYAxisLayout}
      />
    </div>
  {/if}
</div>
