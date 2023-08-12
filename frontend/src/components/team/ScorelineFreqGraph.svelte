<script lang="ts">
  import { onMount } from "svelte";
  import { teamInSeason } from "../../lib/team";

  function insertSeasonAvgScoreFreq(
    scoreFreq: ScoreFreq,
    form: Form,
    team: string,
    season: number
  ) {
    for (let matchday in form[team][season]) {
      let score = form[team][season][matchday].score;
      if (score != null) {
        let scoreStr: string;
        if (form[team][season][matchday].atHome) {
          scoreStr = score.homeGoals + " - " + score.awayGoals;
        } else {
          scoreStr = score.awayGoals + " - " + score.homeGoals;
        }
        if (!(scoreStr in scoreFreq)) {
          scoreFreq[scoreStr] = [1];
        } else {
          scoreFreq[scoreStr][0] += 1;
        }
      }
    }
  }

  function getAvgScoreFreq(data: TeamData): ScoreFreq {
    let scoreFreq: ScoreFreq = {};
    for (let team in data.form) {
      for (let i = 0; i < 3; i++) {
        if (i === 0) {
          insertSeasonAvgScoreFreq(scoreFreq, data.form, team, data._id - i);
        } else if (teamInSeason(data.form, team, data._id - i)) {
          insertSeasonAvgScoreFreq(scoreFreq, data.form, team, data._id - i);
        }
      }
    }

    return scoreFreq;
  }

  function insertSeasonTeamScoreBars(
    scoreFreq: ScoreFreq,
    form: Form,
    team: string,
    season: number
  ) {
    for (let matchday in form[team][season]) {
      let score = form[team][season][matchday].score;
      if (score != null) {
        let scoreStr: string;
        if (form[team][season][matchday].atHome) {
          scoreStr = score.homeGoals + " - " + score.awayGoals;
        } else {
          scoreStr = score.awayGoals + " - " + score.homeGoals;
        }
        scoreFreq[scoreStr][1] += 1;
      }
    }
  }

  function insertTeamScoreBars(
    data: TeamData,
    team: string,
    scoreFreq: ScoreFreq
  ) {
    for (let score in scoreFreq) {
      if (scoreFreq[score].length === 1) {
        scoreFreq[score].push(0);
      }
    }
    insertSeasonTeamScoreBars(scoreFreq, data.form, team, data._id);
    if (teamInSeason(data.form, team, data._id - 1)) {
      insertSeasonTeamScoreBars(scoreFreq, data.form, team, data._id - 1);
    }
    if (teamInSeason(data.form, team, data._id - 2)) {
      insertSeasonTeamScoreBars(scoreFreq, data.form, team, data._id - 2);
    }
  }

  function getColours(scores: string[]): string[] {
    let colours = [];
    for (let score of scores) {
      let [hs, _, as] = score.split(" ");
      let h = parseInt(hs);
      let a = parseInt(as);
      if (h > a) {
        colours.push("#00fe87");
      } else if (h < a) {
        colours.push("#f83027");
      } else {
        colours.push("#ffdd00");
      }
    }
    return colours;
  }

  function separateBars(scoreFreq: ScoreFreq): any[] {
    let sorted = Object.entries(scoreFreq).sort((a, b) => b[1][0] - a[1][0]);
    let x = [];
    let avgY = [];
    let teamY = [];
    for (let i = 0; i < sorted.length; i++) {
      x.push(sorted[i][0]);
      avgY.push(sorted[i][1][0]);
      teamY.push(sorted[i][1][1]);
    }
    let colours = getColours(x);

    return [
      {
        x: x,
        y: avgY,
        type: "bar",
        name: "Avg",
        marker: { color: "#C6C6C6" },
        hovertemplate: `%{x} with probability <b>%{y:.2f}</b><extra></extra>`,
        hoverinfo: "x+y",
      },
      {
        x: x,
        y: teamY,
        type: "bar",
        name: "Scorelines",
        marker: { color: colours },
        hovertemplate: `%{x} with probability <b>%{y:.2f}</b><extra></extra>`,
        hoverinfo: "x+y",
        opacity: 0.5,
      },
    ];
  }

  function scaleBars(scoreFreq: ScoreFreq) {
    let avgTotal = 0;
    let teamTotal = 0;
    for (let score in scoreFreq) {
      avgTotal += scoreFreq[score][0];
      teamTotal += scoreFreq[score][1];
    }
    // Scale team frequency values to match average
    for (let score in scoreFreq) {
      scoreFreq[score][1] *= avgTotal / teamTotal;
    }
  }

  function convertToPercentage(scoreFreq: ScoreFreq) {
    let avgTotal = 0;
    let teamTotal = 0;
    for (let score in scoreFreq) {
      avgTotal += scoreFreq[score][0];
      teamTotal += scoreFreq[score][1];
    }
    // Scale team frequency values to match average
    for (let score in scoreFreq) {
      scoreFreq[score][0] /= avgTotal;
      scoreFreq[score][1] /= teamTotal;
    }
  }

  function defaultLayout(): Object {
    return {
      title: false,
      autosize: true,
      margin: { r: 20, l: 65, t: 15, b: 60, pad: 5 },
      hovermode: "closest",
      barmode: "overlay",
      bargap: 0,
      plot_bgcolor: "#fafafa",
      paper_bgcolor: "#fafafa",
      yaxis: {
        title: { text: "Probability" },
        gridcolor: "gray",
        showgrid: false,
        showline: false,
        zeroline: false,
        fixedrange: true,
      },
      xaxis: {
        title: { text: "Scoreline" },
        linecolor: "black",
        showgrid: false,
        showline: false,
        fixedrange: true,
      },
      legend: {
        x: 1,
        xanchor: "right",
        y: 0.95,
      },
      dragmode: false,
    };
  }

  function setDefaultLayout() {
    if (setup) {
      let layoutUpdate = {
        "yaxis.title": { text: "Probability" },
        "yaxis.visible": true,
        "xaxis.tickfont.size": 12,
        "margin.l": 65,
      };
      //@ts-ignore
      Plotly.update(plotDiv, {}, layoutUpdate);
    }
  }

  function setMobileLayout() {
    if (setup) {
      let layoutUpdate = {
        "yaxis.title": null,
        "yaxis.visible": false,
        "xaxis.tickfont.size": 5,
        "margin.l": 20,
      };
      //@ts-ignore
      Plotly.update(plotDiv, {}, layoutUpdate);
    }
  }

  function buildPlotData(data: TeamData, team: string): PlotData {
    scoreFreq = getAvgScoreFreq(data);

    insertTeamScoreBars(data, team, scoreFreq);
    scaleBars(scoreFreq);
    convertToPercentage(scoreFreq);
    let bars = separateBars(scoreFreq);

    let plotData = {
      data: bars,
      layout: defaultLayout(),
      config: {
        responsive: true,
        showSendToCloud: false,
        displayModeBar: false,
      },
    };
    return plotData;
  }

  function genPlot() {
    plotData = buildPlotData(data, team);
    //@ts-ignore
    new Plotly.newPlot(
      plotDiv,
      plotData.data,
      plotData.layout,
      plotData.config
    ).then((plot) => {
      // Once plot generated, add resizable attribute to it to shorten height for mobile view
      plot.children[0].children[0].classList.add("resizable-graph");
    });
  }

  function resetTeamBars(scoreFreq: ScoreFreq) {
    for (let score in scoreFreq) {
      scoreFreq[score][1] = 0;
    }
  }

  function refreshPlot() {
    if (setup) {
      resetTeamBars(scoreFreq);
      insertTeamScoreBars(data, team, scoreFreq);
      scaleBars(scoreFreq);
      convertToPercentage(scoreFreq);
      let bars = separateBars(scoreFreq);
      plotData.data[1] = bars[1]; // Update team bars
      //@ts-ignore
      Plotly.redraw(plotDiv);
      if (mobileView) {
        setMobileLayout();
      }
    }
  }

  type ScoreFreq = {
    [score: string]: number[];
  };

  let plotDiv: HTMLDivElement, plotData: PlotData;
  let scoreFreq: ScoreFreq;
  let setup = false;
  onMount(() => {
    genPlot();
    setup = true;
  });

  $: team && refreshPlot();
  $: !mobileView && setDefaultLayout();
  $: setup && mobileView && setMobileLayout();

  export let data: TeamData, team: string, mobileView: boolean;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
