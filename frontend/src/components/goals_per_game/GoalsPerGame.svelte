<script lang="ts">
  import { onMount } from "svelte";
  import GoalsScoredFreq from "./GoalsScoredFreqGraph.svelte";
  import GoalsConcededFreq from "./GoalsConcededFreqGraph.svelte";

  function avgBars(): any {
    return {
      x: Object.keys(goalFreq),
      y: Object.values(goalFreq),
      type: "bar",
      name: "Avg",
      marker: { color: "#C6C6C6" },
      line: { width: 0 },
      hovertemplate: `Average %{x} with probability <b>%{y:.2f}</b><extra></extra>`,
      hoverinfo: "x+y",
    };
  }

  function teamBars(
    data: Object,
    type: string,
    color: string | string[]
  ): any {
    let opener = "Score";
    if (type == "Conceded") {
      opener = "Concede";
    }
    return {
      x: Object.keys(data),
      y: Object.values(data),
      type: "bar",
      name: type,
      marker: { color: color },
      hovertemplate: `${opener} %{x} with probability <b>%{y:.2f}</b><extra></extra>`,
      // marker: { color: color },
      line: { width: 0 },
      hoverinfo: "x+y",
      opacity: 0.5,
    };
  }

  function bars(
    data: Object,
    name: string,
    color: string | string[]
  ): [any, any] {
    return [avgBars(), teamBars(data, name, color)];
  }

  // Basic colour scale shared between the two bar chars
  // let colourScale = ["#5df455", "#b2d000", "#dfa700", "#f77a1c", "#f74d4d"];
  let colourScale = ["#00fe87", "#aef23e", "#ffdd00", "#ff9000", "#f83027"];

  // Concatenate unique extreme colours, for extreme values that only a few teams achieve
  // Concatenate bright greens
  let scoredColourScale = reversed(colourScale).concat([
    "#00fe87",
    "#00fe87",
    "#00fe87",
    "#00fe87",
    "#00fe87",
  ]);
  // Concatenate bright reds
  let concededColourScale = colourScale.concat([
    "#f83027",
    "#f83027",
    "#f83027",
    "#f83027",
    "#f83027",
  ]);

  function reversed(arr: any[]) {
    return arr.slice().reverse();
  }

  function getScoredBars(): [any, any] {
    // return bars(teamScoredFreq, "Goals scored", "#77DD77");
    return bars(teamScoredFreq, "Scored", scoredColourScale);
  }

  function getConcededBars(): [any, any] {
    return bars(teamConcededFreq, "Conceded", concededColourScale);
  }

  function getScoredTeamBars(): [any, any] {
    return teamBars(teamScoredFreq, "Scored", scoredColourScale);
  }

  function getConcededTeamBars(): [any, any] {
    return teamBars(teamConcededFreq, "Conceded", concededColourScale);
  }

  function getXLabels(): string[] {
    return Object.keys(goalFreq);
  }

  function getYAxisLayout(): any {
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

  function countScored(data: TeamData, goalFreq: Object, season: number, team: string) {
    if (!(team in data.form)) {
      return;
    }

    for (let matchday of Object.keys(data.form[team][season])) {
      let score = data.form[team][season][matchday].score;
      if (score != null) {
        let [h, _, a] = score.split(" ");
        h = parseInt(h);
        a = parseInt(a);
        if (data.form[team][season][matchday].atHome) {
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

  function maxObjKey(obj: Object): number {
    let max = 0;
    for (let goals in obj) {
      let g = parseInt(goals);
      if (g > max) {
        max = g;
      }
    }
    return max
  }

  function fillGoalFreqBlanks(goalFreq: Object) {
    let max = maxObjKey(goalFreq);
    for (let i = 1; i < max; i++) {
      if (!(i in goalFreq)) {
        goalFreq[i] = 0
      }
    }
  }

  function avgGoalFrequencies(data: TeamData): Object {
    let goalFreq: Object = {};
    for (let team of Object.keys(data.standings)) {
      countScored(data, goalFreq, data._id, team);
      countScored(data, goalFreq, data._id - 1, team);
    }

    fillGoalFreqBlanks(goalFreq)
    
    // Divide by number of teams to get avg
    for (let goals of Object.keys(goalFreq)) {
      goalFreq[goals] /= 20;
    }

    return goalFreq;
  }

  function teamScoredFrequencies(data: TeamData, team: string): Object {
    let goalFreq: Object = {};
    countScored(data, goalFreq, data._id, team);
    countScored(data, goalFreq, data._id - 1, team);
    fillGoalFreqBlanks(goalFreq)
    
    return goalFreq;
  }

  function countConceded(
    data: TeamData,
    goalFreq: Object,
    season: number,
    team: string
  ) {
    if (!(team in data.form)) {
      return;
    }

    for (let matchday of Object.keys(data.form[team][season])) {
      let score = data.form[team][season][matchday].score;
      if (score != null) {
        let [h, _, a] = score.split(" ");
        h = parseInt(h);
        a = parseInt(a);
        if (data.form[team][season][matchday].atHome) {
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
  
  function teamConcededFrequencies(data: TeamData, team: string): Object {
    let goalFreq: Object = {};
    countConceded(data, goalFreq, data._id, team);
    countConceded(data, goalFreq, data._id - 1, team);
    fillGoalFreqBlanks(goalFreq)

    return goalFreq;
  }

  function checkForMax(freq: Object, max: number): number {
    for (let goals of Object.values(freq)) {
      if (goals > max) {
        max = goals;
      }
    }
    return max;
  }

  function maxValue(
    goalFreq: Object,
    teamScoredFreq: Object,
    teamConcededFreq: Object
  ): number {
    let max = 0;
    max = checkForMax(goalFreq, max);
    max = checkForMax(teamScoredFreq, max);
    max = checkForMax(teamConcededFreq, max);
    return max;
  }

  function valueSum(obj: Object): number {
    let total = 0;
    for (let freq in obj) {
      total += obj[freq];
    }
    return total;
  }

  function scaleTeamFreq(
    goalFreq: Object,
    teamScoredFreq: Object,
    teamConcededFreq: Object
  ) {
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

  function convertToPercentage(freq: Object) {
    let totalFreq = valueSum(freq);
    for (let goals in freq) {
      freq[goals] /= totalFreq;
    }
  }

  function convertAllToPercentage(
    goalFreq: Object,
    teamScoredFreq: Object,
    teamConcededFreq: Object
  ) {
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

  let goalFreq: Object,
    teamScoredFreq: Object,
    teamConcededFreq: Object,
    maxY: number;
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

  export let data: TeamData, team: string, mobileView: boolean;
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
        {mobileView}
      />
    </div>
    <div class="graph freq-graph mini-graph">
      <GoalsConcededFreq
        {team}
        {getConcededBars}
        {getConcededTeamBars}
        {getXLabels}
        {getYAxisLayout}
        {mobileView}
      />
    </div>
  {/if}
</div>

<style scoped>
  .two-graphs {
    display: flex;
    margin: 0 8%;
  }

  @media only screen and (max-width: 1000px) {
    .two-graphs {
      display: flex;
      margin: 0;
    }
  }
</style>
