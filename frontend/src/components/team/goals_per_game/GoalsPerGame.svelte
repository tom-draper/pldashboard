<script lang="ts">
  import { onMount } from 'svelte';
  import GoalsScoredFreq from './GoalsScoredFreqGraph.svelte';
  import GoalsConcededFreq from './GoalsConcededFreqGraph.svelte';
  import type { DashboardData, Team } from '../../../lib/dashboard.types';

  function avgBars() {
    return {
      x: Object.keys(goalFreq),
      y: Object.values(goalFreq),
      type: 'bar',
      name: 'Avg',
      marker: { color: '#C6C6C6' },
      line: { width: 0 },
      hovertemplate: `Average %{x} with probability <b>%{y:.2f}</b><extra></extra>`,
      hoverinfo: 'x+y',
    };
  }

  function teamBars(
    data: DashboardData,
    type: string,
    color: string | string[]
  ) {
    let opener = 'Score';
    if (type === 'Conceded') {
      opener = 'Concede';
    }
    return {
      x: Object.keys(data),
      y: Object.values(data),
      type: 'bar',
      name: type,
      marker: { color: color },
      hovertemplate: `${opener} %{x} with probability <b>%{y:.2f}</b><extra></extra>`,
      line: { width: 0 },
      hoverinfo: 'x+y',
      opacity: 0.5,
    };
  }

  function bars(data: DashboardData, name: string, color: string | string[]) {
    return [avgBars(), teamBars(data, name, color)];
  }

  // Basic colour scale shared between the two bar chars
  const colourScale = ['#00fe87', '#aef23e', '#ffdd00', '#ff9000', '#f83027'];

  // Concatenate unique extreme colours, for extreme values that only a few teams achieve
  // Concatenate bright greens
  const scoredColourScale = reversed(colourScale).concat([
    '#00fe87',
    '#00fe87',
    '#00fe87',
    '#00fe87',
    '#00fe87',
  ]);
  // Concatenate bright reds
  const concededColourScale = colourScale.concat([
    '#f83027',
    '#f83027',
    '#f83027',
    '#f83027',
    '#f83027',
  ]);

  function reversed(arr) {
    return arr.slice().reverse();
  }

  function getScoredBars() {
    // return bars(teamScoredFreq, "Goals scored", "#77DD77");
    return bars(teamScoredFreq, 'Scored', scoredColourScale);
  }

  function getConcededBars() {
    return bars(teamConcededFreq, 'Conceded', concededColourScale);
  }

  function getScoredTeamBars() {
    return teamBars(teamScoredFreq, 'Scored', scoredColourScale);
  }

  function getConcededTeamBars() {
    return teamBars(teamConcededFreq, 'Conceded', concededColourScale);
  }

  function getXLabels(): string[] {
    return Object.keys(goalFreq);
  }

  function getYAxisLayout() {
    return {
      title: { text: 'Probability' },
      gridcolor: 'gray',
      showgrid: false,
      showline: false,
      zeroline: false,
      fixedrange: true,
      autorange: false,
      range: [0, maxY],
    };
  }

  function countScored(
    data: DashboardData,
    goalFreq,
    season: number,
    team: string
  ) {
    if (!(team in data.form)) {
      return;
    }

    for (const matchday of Object.keys(data.form[team][season])) {
      const score = data.form[team][season][matchday].score;
      if (score == null) {
        continue;
      }
      if (data.form[team][season][matchday].atHome) {
        if (score.homeGoals in goalFreq) {
          goalFreq[score.homeGoals] += 1;
        } else {
          goalFreq[score.homeGoals] = 1;
        }
      } else {
        if (score.awayGoals in goalFreq) {
          goalFreq[score.awayGoals] += 1;
        } else {
          goalFreq[score.awayGoals] = 1;
        }
      }
    }
  }

  function maxObjKey(obj): number {
    let max = 0;
    for (const goals in obj) {
      const g = parseInt(goals);
      if (g > max) {
        max = g;
      }
    }
    return max;
  }

  function fillGoalFreqBlanks(goalFreq) {
    const max = maxObjKey(goalFreq);
    for (let i = 1; i < max; i++) {
      if (!(i in goalFreq)) {
        goalFreq[i] = 0;
      }
    }
  }

  function avgGoalFrequencies(data: DashboardData) {
    const goalFreq = {};
    for (const team of Object.keys(data.standings)) {
      countScored(data, goalFreq, data._id, team);
      countScored(data, goalFreq, data._id - 1, team);
    }

    fillGoalFreqBlanks(goalFreq);

    // Divide by number of teams to get avg
    for (const goals of Object.keys(goalFreq)) {
      goalFreq[goals] /= 20;
    }

    return goalFreq;
  }

  function teamScoredFrequencies(data: DashboardData, team: Team) {
    const goalFreq = {};
    countScored(data, goalFreq, data._id, team);
    countScored(data, goalFreq, data._id - 1, team);
    fillGoalFreqBlanks(goalFreq);

    return goalFreq;
  }

  function countConceded(
    data: DashboardData,
    goalFreq,
    season: number,
    team: Team
  ) {
    if (!(team in data.form)) {
      return;
    }

    for (const matchday of Object.keys(data.form[team][season])) {
      const score = data.form[team][season][matchday].score;
      if (score == null) {
        continue;
      }
      if (data.form[team][season][matchday].atHome) {
        if (score.awayGoals in goalFreq) {
          goalFreq[score.awayGoals] += 1;
        } else {
          goalFreq[score.awayGoals] = 1;
        }
      } else {
        if (score.homeGoals in goalFreq) {
          goalFreq[score.homeGoals] += 1;
        } else {
          goalFreq[score.homeGoals] = 1;
        }
      }
    }
  }

  function teamConcededFrequencies(data: DashboardData, team: Team) {
    const goalFreq = {};
    countConceded(data, goalFreq, data._id, team);
    countConceded(data, goalFreq, data._id - 1, team);
    fillGoalFreqBlanks(goalFreq);

    return goalFreq;
  }

  function checkForMax(freq: { [value: string]: number }, max: number): number {
    for (const goals of Object.values(freq)) {
      if (goals > max) {
        max = goals;
      }
    }
    return max;
  }

  function maxValue(goalFreq, teamScoredFreq, teamConcededFreq): number {
    let max = 0;
    max = checkForMax(goalFreq, max);
    max = checkForMax(teamScoredFreq, max);
    max = checkForMax(teamConcededFreq, max);
    return max;
  }

  function valueSum(obj): number {
    let total = 0;
    for (const freq in obj) {
      total += obj[freq];
    }
    return total;
  }

  function scaleTeamFreq(goalFreq, teamScoredFreq, teamConcededFreq) {
    const totalGoalFreq = valueSum(goalFreq);

    const totalTeamScoredFreq = valueSum(teamScoredFreq);
    for (const goals in teamScoredFreq) {
      teamScoredFreq[goals] *= totalGoalFreq / totalTeamScoredFreq;
    }

    const totalTeamConcededFreq = valueSum(teamConcededFreq);
    for (const goals in teamConcededFreq) {
      teamConcededFreq[goals] *= totalGoalFreq / totalTeamConcededFreq;
    }
  }

  function convertToPercentage(freq) {
    const totalFreq = valueSum(freq);
    for (const goals in freq) {
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

  let goalFreq;
  let teamScoredFreq;
  let teamConcededFreq;
  let maxY: number;
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

  export let data: DashboardData, team: Team, mobileView: boolean;
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
  .freq-graph {
    width: 50%;
  }

  @media only screen and (max-width: 1000px) {
    .two-graphs {
      display: flex;
      margin: 0;
    }
  }
</style>
