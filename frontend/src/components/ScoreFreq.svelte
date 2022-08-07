<script>
  import { onMount } from "svelte";

  function getAvgScoreFreq(data) {
    let scoreFreq = {};
    for (let team in data.form[data._id]) {
      for (let matchday in data.form[data._id][team]) {
        let score = data.form[data._id][team][matchday].score;
        if (score != null) {
          let [h, _, a] = score.split(" ");
          if (!data.form[data._id][team][matchday].atHome) {
            score = a + " - " + h;
          }
          if (!(score in scoreFreq)) {
            scoreFreq[score] = [0];
          }
          scoreFreq[score][0] += 1;
        }
      }
      if (team in data.form[data._id]) {
        for (let matchday in data.form[data._id - 1][team]) {
          let score = data.form[data._id - 1][team][matchday].score;
          if (score != null) {
            let [h, _, a] = score.split(" ");
            if (!data.form[data._id - 1][team][matchday].atHome) {
              score = a + " - " + h;
            }
            if (!(score in scoreFreq)) {
              scoreFreq[score] = [0];
            }
            scoreFreq[score][0] += 1;
          }
        }
      }
    }

    return scoreFreq;
  }

  function getScoreFreq(data, team) {
    let scoreFreq = {};
    return scoreFreq;
  }

  // function getScoreBars(data, team) {
  //   let scoreFreq = getScoreFreq(data, team);

  //   let sorted = Object.entries(scoreFreq).sort((a, b) => b[1] - a[1]);

  //   let x = [];
  //   let y = [];
  //   for (let i = 0; i < sorted.length; i++) {
  //     x.push(sorted[i][0])
  //     y.push(sorted[i][1])
  //   }

  //   return {
  //     x: x,
  //     y: y,
  //     type: "bar",
  //     name: `Goals`,
  //     marker: { color: "#0000FF" },
  //     hovertemplate: `%{x} with probability %{y:.2f}<extra></extra>`,
  //     hoverinfo: "x+y",
  //     opacity: 0.6,
  //   };
  // }
  
  // function getAvgScoreBars(data) {
  //   let scoreFreq = getAvgScoreFreq(data);
  //   let sorted = Object.entries(scoreFreq).sort((a, b) => b[1] - a[1]);
  
  //   let x = [];
  //   let y = [];
  //   for (let i = 0; i < sorted.length; i++) {
  //     x.push(sorted[i][0])
  //     y.push(sorted[i][1])
  //   }
    
  //   return {
  //     x: x,
  //     y: y,
  //     type: "bar",
  //     name: `Goals`,
  //     marker: { color: "#C6C6C6" },
  //     hovertemplate: `%{x} with probability %{y:.2f}<extra></extra>`,
  //     hoverinfo: "x+y",
  //     opacity: 0.6,
  //   };
    
  // }
  
  function insertTeamScoreBars(data, team, scoreFreq) {
    for (let score in scoreFreq) {
      if (scoreFreq[score].length == 1) {
        scoreFreq[score].push(0)
      }
    }
    for (let matchday in data.form[data._id][team]) {
      let score = data.form[data._id][team][matchday].score;
      if (score != null) {
        let [h, _, a] = score.split(" ");
        if (!data.form[data._id][team][matchday].atHome) {
          score = a + " - " + h;
        }
        scoreFreq[score][1] += 1;
      }
    }
    for (let matchday in data.form[data._id - 1][team]) {
      let score = data.form[data._id - 1][team][matchday].score;
      if (score != null) {
        let [h, _, a] = score.split(" ");
        if (!data.form[data._id - 1][team][matchday].atHome) {
          score = a + " - " + h;
        }
        scoreFreq[score][1] += 1;
      }
    }
  }

  function getColours(scores) {
    let colours = []
    for (let score of scores) {
      let [h, _, a] = score.split(' ');
      h = parseInt(h);
      a = parseInt(a);
      if (h > a) {
        colours.push('#5df455')
      } else if (h < a) {
        colours.push('#f74d4d');
      } else {
        colours.push('#dfa700');
      }
    }
    return colours
  }
  
  function separateBars(scoreFreq) {  
    let sorted = Object.entries(scoreFreq).sort((a, b) => b[1][0] - a[1][0]);
    let x = [];
    let avgY = [];
    let teamY = [];
    for (let i = 0; i < sorted.length; i++) {
      x.push(sorted[i][0])
      avgY.push(sorted[i][1][0])
      teamY.push(sorted[i][1][1])
    }

    let colours = getColours(x);
  
    return [
      {
      x: x,
      y: avgY,
      type: "bar",
      name: 'Avg',
      marker: { color: "#C6C6C6" },
      hovertemplate: `%{x} with probability %{y:.2f}<extra></extra>`,
      hoverinfo: "x+y",
      // opacity: 0.6,
    },
      {
      x: x,
      y: teamY,
      type: "bar",
      name: 'Scorelines',
      marker: { color: colours },
      hovertemplate: `%{x} with probability %{y:.2f}<extra></extra>`,
      hoverinfo: "x+y",
      opacity: 0.5,
    },
    ];
  }

  function scaleBars(scoreFreq) {
    let avgTotal = 0
    let teamTotal = 0
    for (let score in scoreFreq) {
      avgTotal += scoreFreq[score][0]
      teamTotal += scoreFreq[score][1]
    }
    // Scale team frequency values to match average
    for (let score in scoreFreq) {
      scoreFreq[score][1] *= (avgTotal / teamTotal);
    }
  }

  function convertToPercentage(scoreFreq) {
    let avgTotal = 0
    let teamTotal = 0
    for (let score in scoreFreq) {
      avgTotal += scoreFreq[score][0]
      teamTotal += scoreFreq[score][1]
    }
    // Scale team frequency values to match average
    for (let score in scoreFreq) {
      scoreFreq[score][0] /= avgTotal;
      scoreFreq[score][1] /= teamTotal;
    }
  }

  function buildPlotData(data, team) {
    // let xLabels = getXLabels();
    // let xLabels = scoreBars.

    scoreFreq = getAvgScoreFreq(data);

    insertTeamScoreBars(data, team, scoreFreq);
    scaleBars(scoreFreq, team);
    convertToPercentage(scoreFreq);
    let [avgBars, teamBars] = separateBars(scoreFreq)

    let plotData = {
      data: [avgBars, teamBars],
      layout: {
        title: false,
        autosize: true,
        margin: { r: 10, l: 60, t: 15, b: 100, pad: 5 },
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
          // autorange: false,
          // range: [0, 10],
        },
        xaxis: {
          title: { text: "Scoreline" },
          linecolor: "black",
          showgrid: false,
          showline: false,
          fixedrange: true,
          // ticktext: xLabels,
          // tickvals: xLabels,
        },
        legend: {
          x: 1,
          xanchor: "right",
          y: 0.95,
        },
      },
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

  function resetTeamBars(scoreFreq) {
    for (let score in scoreFreq) {
      scoreFreq[score][1] = 0;
    }
  }

  function refreshPlot() {
    if (setup) {
      resetTeamBars(scoreFreq);
      insertTeamScoreBars(data, team, scoreFreq);
      scaleBars(scoreFreq, team);
      convertToPercentage(scoreFreq);
      let [_, teamBars] = separateBars(scoreFreq, team)
      plotData.data[1] = teamBars; // Update team bars
      Plotly.redraw(plotDiv);
    }
  }

  let plotDiv, plotData;
  let scoreFreq;
  let setup = false;
  onMount(() => {
    genPlot();
    setup = true;
  });

  $: team && refreshPlot();

  export let data, team;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
