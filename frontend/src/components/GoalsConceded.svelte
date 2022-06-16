<script>
  import { onMount } from "svelte";

  function avgGoalFrequencies(data) {
    let goalFreq = {};
    for (let team of data.teamNames) {
      for (let matchday of Object.keys(data.form[team])) {
        let score = data.form[team][matchday].score;
        if (score != "None - None") {
          let [h, _, a] = score.split(' ');
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

  function teamGoalFrequencies(data, team) {
    let goalFreq = {};
    for (let matchday of Object.keys(data.form[team])) {
      let score = data.form[team][matchday].score;
      if (score != "None - None") {
        let [h, _, a] = score.split(' ');
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

  function getGraphData(data, fullTeamName) {
    let goalFreq = avgGoalFrequencies(data);
    let teamGoalFreq = teamGoalFrequencies(data, fullTeamName);

    let xLabels = Object.keys(goalFreq);
    console.log(xLabels);


    let graphData = {
      data: [
        {
          x: Object.keys(goalFreq),
          y: Object.values(goalFreq),
          type: 'bar',
          name: 'Avg',
          marker: {color: '#d3d3d3'},
          line: {width: 0},
          hovertemplate: '%{x} goals: %{y}<extra></extra>',
          hoverinfo: 'x+y'
        },
        {
          x: Object.keys(teamGoalFreq),
          y: Object.values(teamGoalFreq),
          type: 'bar',
          name: 'Goals conceded',
          marker: {color: '#C23B22'},
          line: {width: 0},
          hovertemplate: '%{x} goals: %{y}<extra></extra>',
          hoverinfo: 'x+y',
          opacity: 0.6,

        },
      ],
      layout: {
        title: false,
        autosize: true,
        margin: { r: 0, l: 50, t: 0, b: 40, pad: 5 },
        hovermode: "closest",
        barmode: 'overlay',
        bargap: 0,
        plot_bgcolor: "#fafafa",
        paper_bgcolor: "#fafafa",
        yaxis: {
          title: { text: "Frequency" },
          gridcolor: "gray",
          showgrid: false,
          showline: false,
          zeroline: false,
          fixedrange: true,
        },
        xaxis: {
          title: {text: 'Goals Conceded'},
          linecolor: "black",
          showgrid: false,
          showline: false,
          fixedrange: true,
          ticktext: xLabels,
          tickvals: xLabels,
        },
        legend: {
          y: 0.95,
          x: 0.7
        }
      },
      config: {
        responsive: true,
        showSendToCloud: false,
        displayModeBar: false,
      },
    };
    return graphData;
  }

  let plotDiv;
  let graphData;
  onMount(() => {
    graphData = getGraphData(data, fullTeamName);
    let Plot = new Plotly.newPlot(
      plotDiv,
      graphData.data,
      graphData.layout,
      graphData.config
    );
  });

  export let data, fullTeamName;
</script>

<div id="plotly">
  <div id="plotDiv" bind:this={plotDiv}>
    <!-- Plotly chart will be drawn inside this DIV -->
  </div>
</div>
