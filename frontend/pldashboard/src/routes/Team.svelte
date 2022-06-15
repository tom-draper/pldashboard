<script>
  import { Router, Link } from "svelte-routing";
  import { onMount } from "svelte";
  import Fixtures from "../components/Fixtures.svelte";

  let graphData = { x: [1, 2, 3], y: [1, 2, 3], type: "bar" };

  function toTitleCase(str) {
    return str
      .toLowerCase()
      .split(" ")
      .map(function (word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }

  function ordinal(n) {
    var ord = [, "st", "nd", "rd"];
    var a = n % 100;
    return n + (ord[a > 20 ? a % 10 : a] || "th");
  }

  function getStatsRank(data, attribute, fullTeamName, reverse) {
    let sorted = Object.keys(data.seasonStats).sort(function (a, b) {
      return data.seasonStats[b][attribute] - data.seasonStats[a][attribute];
    });
    let rank = sorted.indexOf(fullTeamName) + 1;
    if (reverse) {
      rank = 21 - rank;
    }
    return rank;
  }

  function getStatsRankings(data, fullTeamName) {
    let xGRank = ordinal(getStatsRank(data, "xG", fullTeamName, false));
    // Reverse - lower rank the better
    let xCRank = ordinal(getStatsRank(data, "xC", fullTeamName, true));
    let cleanSheetRatioRank = ordinal(
      getStatsRank(data, "cleanSheetRatio", fullTeamName, false)
    );
    return { xG: xGRank, xC: xCRank, cleanSheetRatio: cleanSheetRatioRank };
  }

  function tableSnippetRange(sortedTeams, fullTeamName) {
    let teamStandingsIdx = sortedTeams.indexOf(fullTeamName);

    let low = teamStandingsIdx - 3;
    let high = teamStandingsIdx + 4;
    if (low < 0) {
      let overflow = low;
      high -= overflow;
      low = 0;
    }
    if (high > sortedTeams.length - 1) {
      let overflow = high - sortedTeams.length;
      low -= overflow;
      high = sortedTeams.length;
    }

    return [low, high];
  }

  function getTableSnippet(data, fullTeamName) {
    let sortedTeams = Object.keys(data.standings).sort(function (teamA, teamB) {
      return (
        data.standings[teamB][data.currentSeason].points -
        data.standings[teamA][data.currentSeason].points
      );
    });

    let [low, high] = tableSnippetRange(sortedTeams, fullTeamName);

    let teamTableIdx;
    let rows = [];
    for (let i = low; i < high; i++) {
      if (sortedTeams[i] == fullTeamName) {
        teamTableIdx = i;
      }
      rows.push({
        name: sortedTeams[i],
        position: data.standings[sortedTeams[i]][data.currentSeason].position,
        points: data.standings[sortedTeams[i]][data.currentSeason].points,
        gd: data.standings[sortedTeams[i]][data.currentSeason].gD,
      });
    }

    return {
      teamTableIdx: teamTableIdx,
      rows: rows,
    };
  }

  function getTeamData(fullTeamName, json) {
    let currentMatchday = getCurrentMatchday(json, fullTeamName);
    let rank = getStatsRankings(json, fullTeamName);
    let tableSnippet = getTableSnippet(json, fullTeamName);
    return { currentMatchday, rank, tableSnippet };
  }

  function toInitials(fullTeamName) {
    switch (fullTeamName) {
      case "Brighton and Hove Albion FC":
        return "BHA";
      case "Manchester City FC":
        return "MCI";
      case "Aston Villa FC":
        return "AVL";
      case "Sheffield United FC":
        return "SHU";
      case "West Bromwich Albion FC":
        return "WBA";
      case "West Ham United FC":
        return "WHU";
    }
    return fullTeamName.slice(0, 3).toUpperCase();
  }

  function getCurrentMatchday(data, fullTeamName) {
    return Object.keys(data.form[fullTeamName]).reduce((a, b) =>
      data.form[fullTeamName][a] > data.form[fullTeamName][b] ? a : b
    );
  }

  function setPositionalOffset() {
    document.documentElement.style.setProperty(
      "--ssp1-offset",
      -ssp1.clientWidth / 2 + "px"
    );
    document.documentElement.style.setProperty(
      "--ssp2-offset",
      -ssp2.clientWidth / 2 + "px"
    );
    document.documentElement.style.setProperty(
      "--ssp3-offset",
      -ssp3.clientWidth / 2 + "px"
    );
  }

  function getMatchDetail(match) {
    let matchDetail;
    let homeAway = match.atHome ? "Home" : "Away";
    if (match.score != null) {
      matchDetail = `${match.team} (${homeAway}) ${match.score}`;
    } else {
      matchDetail = `${match.team} (${homeAway})`;
    }
    return matchDetail;
  }

  function sortByMatchDate(x, y, details) {
    let list = [];
    for (let i = 0; i < x.length; i++) {
      list.push({ x: x[i], y: y[i], details: details[i] });
    }

    list.sort(function (a, b) {
      return a.x < b.x ? -1 : a.x == b.x ? 0 : 1;
    });

    for (let i = 0; i < list.length; i++) {
      x[i] = list[i].x;
      y[i] = list[i].y;
      details[i] = list[i].details;
    }
  }

  function increaseNextGameMarker(sizes, x, now, bigMarkerSize) {
    // Get matchday date with smallest time difference to now
    let nextGameIdx;
    let minDiff = Number.POSITIVE_INFINITY;
    for (let i = 0; i < x.length; i++) {
      let diff = x[i] - now;
      if (0 < diff && diff < minDiff) {
        minDiff = diff;
        nextGameIdx = i;
      }
    }

    // Increase marker size of next game
    if (nextGameIdx != undefined) {
      sizes[nextGameIdx] = bigMarkerSize;
    }

    return sizes;
  }

  function getFixturesGraphData(data, fullTeamName) {
    // Build data to create a fixtures line graph displaying the date along the
    // x-axis and opponent strength along the y-axis
    let x = [];
    let y = [];
    let details = [];
    for (let i = 1; i < Object.keys(data.fixtures[fullTeamName]).length; i++) {
      let match = data.fixtures[fullTeamName][i];
      x.push(new Date(match.date));

      let oppTeamRating = data.teamRatings[match.team].totalRating;
      if (match.atHome) {
        // If team playing at home, decrease opposition rating by the amount of home advantage the team gains
        oppTeamRating *= (1 - data.homeAdvantages[match.team].totalHomeAdvantage)
      }
      y.push(oppTeamRating * 100);

      let matchDetail = getMatchDetail(match);
      details.push(matchDetail);
    }

    sortByMatchDate(x, y, details);

    let now = Date.now();

    let sizes = Array(x.length).fill(14);
    sizes = increaseNextGameMarker(sizes, x, now, 26);

    let matchdays = Array.from({length: 38}, (_, index) => (index + 1));

    let graphData = {
      data: {
        x: x,
        y: y,
        type: "scatter",
        mode: "lines+markers",
        text: details,
        line: {
          color: "#737373",
        },
        marker: {
          size: sizes,
          colorscale: [
            [0, "#01c626"],
            [0.1, "#08a825"],
            [0.2, "#0b7c20"],
            [0.3, "#0a661b"],
            [0.4, "#064411"],
            [0.5, "#000000"],
            [0.6, "#5b1d15"],
            [0.7, "#85160f"],
            [0.8, "#ad1a10"],
            [0.9, "#db1a0d"],
            [1, "#fc1303"],
          ],
          color: y,
        },
        customdata: matchdays,
        hovertemplate:
          "<b>%{text}</b><br>Matchday %{customdata}<br>%{x|%d %b %Y}<br>Team rating: <b> %{y:.1f}%</b><extra></extra>"
      },
      layout: {
        title: false,
        autosize: true,
        margin: { r: 20, l: 50, t: 0, b: 40, pad: 5 },
        hovermode: 'closest',
        plot_bgcolor: "#fafafa",
        paper_bgcolor: "#fafafa",
        yaxis: {
          title: { text: "Team Rating" },
          gridcolor: "gray",
          showline: false,
          zeroline: false,
          fixedrange: true,
        },
        xaxis: {
          // title: { text: "Matchday" },
          linecolor: "black",
          showgrid: false,
          showline: false,
          fixedrange: true,
        },
      },
      config: {
        responsive: true,
        showSendToCloud: false,
        displayModeBar: false,
      },
    };
    return graphData;
  }

  async function fetchData(address) {
    const response = await fetch(address);
    let json = await response.json();
    return json;
  }

  let ssp1, ssp2, ssp3;
  let fullTeamName = "";
  let teamData;
  let data;
  let fixturesData;
  let formData;
  let positionGraphData;
  let goalsScoredAndConcededGraphData;
  let goalsPerGameGraphData;
  onMount(() => {
    fullTeamName = toTitleCase(team.replace("-", " ")) + " FC";
    fetchData("http://127.0.0.1:5000/teams")
      .then((json) => {
        // Build teamData package from json data
        teamData = getTeamData(fullTeamName, json);
        data = json;
        console.log(data);
      })
      .then((_) => {
        setPositionalOffset();
        // Keep positional value the correct offset
        window.addEventListener("resize", setPositionalOffset);
      })
      .then((_) => {
        // Generate graphs
        fixturesData = getFixturesGraphData(data, fullTeamName);
      });
  });

  export let team;
</script>

<svelte:head>
  <title>{fullTeamName}</title>
  <meta name="description" content="Premier League Statistics Dashboard" />
</svelte:head>

<Router>
  <div class="header" style="background-color: var(--{team});">
    <!-- <Link to="/ ">
      <div id="back-button" class="main-link" />
    </Link> -->
    <Link to="/{team}">
      <div
        class="main-link title no-decoration"
        style="color: var(--{team + '-secondary'});"
      >
        {fullTeamName}
      </div>
    </Link>
  </div>

  {#if data != undefined}
    <div class="page-content">
      <div class="row">
        <div
          class="row-left position-and-badge"
          style="background-image: url('{data.logoURLs[
            fullTeamName
          ]}'); background-repeat: no-repeat; background-size: auto 450px; background-position: right center;"
        >
          <div class="position">
            {data.standings[fullTeamName][data.currentSeason].position}
          </div>
        </div>
        <div class="fixtures-graph row-graph">
          <h1 class="lowered">Fixtures</h1>
          <!-- Not included in an iframe to ensure it loads before page is rendered -->
          <div class="graph mini-graph">
            {#if fixturesData != undefined}
              <Fixtures graphData={fixturesData} />
              <!-- {% include 'graphs/%s/fixtures-%s.html' % (params.team.names.hyphenated, params.team.names.hyphenated) %} -->
            {/if}
          </div>
        </div>
      </div>

      <div class="row">
        <div class="row-left form-details">
          <div class="current-form-row">
            <div
              class="icon pos-0 {data.form[fullTeamName][
                teamData.currentMatchday
              ].form5.charAt(0)} {data.form[fullTeamName][
                teamData.currentMatchday
              ].beatStarTeam
                ? 'star-team'
                : ''}"
            />
            <div
              class="icon pos-1 {data.form[fullTeamName][
                teamData.currentMatchday
              ].form5.charAt(1)} {data.form[fullTeamName][
                teamData.currentMatchday - 1
              ].beatStarTeam
                ? 'star-team'
                : ''}"
            />
            <div
              class="icon pos-2 {data.form[fullTeamName][
                teamData.currentMatchday
              ].form5.charAt(2)} {data.form[fullTeamName][
                teamData.currentMatchday - 2
              ].beatStarTeam
                ? 'star-team'
                : ''}"
            />
            <div
              class="icon pos-3 {data.form[fullTeamName][
                teamData.currentMatchday
              ].form5.charAt(3)} {data.form[fullTeamName][
                teamData.currentMatchday - 3
              ].beatStarTeam
                ? 'star-team'
                : ''}"
            />
            <div
              class="icon pos-4 {data.form[fullTeamName][
                teamData.currentMatchday
              ].form5.charAt(4)} {data.form[fullTeamName][
                teamData.currentMatchday - 4
              ].beatStarTeam
                ? 'star-team'
                : ''}"
            />
          </div>
          <div class="current-form-row">
            <div class="icon-name pos-0">
              {toInitials(
                data.form[fullTeamName][teamData.currentMatchday].team
              )}
            </div>
            <div class="icon-name pos-1">
              {toInitials(
                data.form[fullTeamName][teamData.currentMatchday - 1].team
              )}
            </div>
            <div class="icon-name pos-2">
              {toInitials(
                data.form[fullTeamName][teamData.currentMatchday - 2].team
              )}
            </div>
            <div class="icon-name pos-3">
              {toInitials(
                data.form[fullTeamName][teamData.currentMatchday - 3].team
              )}
            </div>
            <div class="icon-name pos-4">
              {toInitials(
                data.form[fullTeamName][teamData.currentMatchday - 4].team
              )}
            </div>
          </div>
          <div class="current-form">
            Current form: {(
              data.form[fullTeamName][teamData.currentMatchday].formRating5 *
              100
            ).toFixed(2)}%
          </div>

          <div class="table-sniteamData.teamData.ppet">
            <div class="divider" />
            <div class="table-row">
              <div class="table-element table-position column-title" />
              <div class="table-element table-team-name column-title">Team</div>
              <div class="table-element table-gd column-title">GD</div>
              <div class="table-element table-points column-title">Points</div>
            </div>

            {#each Array(teamData.tableSnippet.rows.length) as _, i}
              <!-- Divider -->
              {#if i == 0}
                {#if i != teamData.tableSnippet.teamTableIdx}
                  <div id="divider" />
                {/if}
              {:else if i - 1 != teamData.tableSnippet.teamTableIdx && i != teamData.tableSnippet.teamTableIdx}
                <div id="divider" />
              {/if}

              <!-- Row of table -->
              {#if i == teamData.tableSnippet.teamTableIdx}
                <!-- Highlighted row for the team of the current page -->
                <div
                  class="table-row this-team"
                  style="background-color: var(--{team});"
                >
                  <div
                    class="table-element table-position this-team"
                    style="color: var(--{team}-secondary);"
                  >
                    {teamData.tableSnippet.rows[i].position}
                  </div>
                  <div
                    class="table-element table-team-name this-team"
                    style="color: var(--{team}-secondary);"
                  >
                    {teamData.tableSnippet.rows[i].name}
                  </div>
                  <div
                    class="table-element table-gd this-team"
                    style="color: var(--{team}-secondary);"
                  >
                    {teamData.tableSnippet.rows[i].gd}
                  </div>
                  <div
                    class="table-element table-points this-team"
                    style="color: var(--{team}-secondary);"
                  >
                    {teamData.tableSnippet.rows[i].points}
                  </div>
                </div>
              {:else}
                <!-- Plain row -->
                <div class="table-row">
                  <div class="table-element table-position">
                    {teamData.tableSnippet.rows[i].position}
                  </div>
                  <div class="table-element table-team-name">
                    {teamData.tableSnippet.rows[i].name}
                  </div>
                  <div class="table-element table-gd">
                    {teamData.tableSnippet.rows[i].gd}
                  </div>
                  <div class="table-element table-points">
                    {teamData.tableSnippet.rows[i].points}
                  </div>
                </div>
              {/if}
            {/each}
            {#if teamData.tableSnippet.teamTableIdx != 6}
              <div id="divider" />
            {/if}
          </div>
        </div>

        <div
          class="next-game-prediction row-graph"
          style="border: 6px solid var(--{data.upcoming[fullTeamName]
            .nextTeam});"
        >
          {#if data.upcoming[fullTeamName].nextTeam != null}
            <!-- Pre or mid season -->
            <div
              class="next-game-title"
              style="background-color: var(--{data.upcoming[
                fullTeamName
              ].nextTeam
                .replace(' FC', '')
                .toLowerCase()
                .replace(' ', '-')});"
            >
              <h1
                class="next-game-title-text"
                style="color: var(--{data.upcoming[fullTeamName].nextTeam
                  .replace(' FC', '')
                  .toLowerCase()
                  .replace(' ', '-')}-secondary);"
              >
                Next Game:
                <a
                  href="/{data.upcoming[fullTeamName].nextTeam
                    .replace(' FC', '')
                    .toLowerCase()
                    .replace(' ', '-')}"
                  class="no-decoration"
                  style="color: inherit"
                >
                  {data.upcoming[fullTeamName].nextTeam}
                </a><span class="parenthesis">(</span>{data.upcoming[
                  fullTeamName
                ].atHome}<span class="parenthesis">)</span>
              </h1>
            </div>
          {:else}
            <!-- Season complete -->
            <div class="next-game-season-complete">
              <h1 class="next-game-title-text">
                {data.currentSeason}/{data.currentSeason + 1} SEASON COMPLETE
              </h1>
            </div>
          {/if}
        </div>

        {#if data.upcoming[fullTeamName].nextTeam != null}
          <div class="next-game-values">
            <div class="predictions-and-logo">
              <div
                class="next-game-logo opposition-badge"
                style="background-image: url('{data.logoURLs[
                  data.upcoming[fullTeamName].nextTeam
                ]}');
                            background-repeat: no-repeat;
                            background-size: contain;
                            background-position: center;"
              />
              <div class="predictions">
                <div class="next-game-item">
                  Current form:
                  <b
                    >{data.form[data.upcoming[fullTeamName].nextTeam][
                      teamData.currentMatchday
                    ].formRating5}%</b
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
                    <b>{data.upcoming.prediction[fullTeamName].accuracy}%</b
                    ></span
                  ><br />
                  <div class="accuracy-item">
                    General results accuracy:
                    <b
                      >{data.upcoming.prediction[fullTeamName]
                        .resultsAccuracy}%</b
                    >
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
                <div class="next-game-item prev-results-title">
                  Previous Results
                </div>
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
      </div>

      <div class="row">
        <div class="form-graph row-graph">
          <h1 class="lowered">Form Over Time</h1>
          <div class="graph full-row-graph" style="height: auto">
            <!-- {% include 'graphs/%s/form-over-time-%s.html' % (params.team.names.hyphenated, params.team.names.hyphenated) %} -->
          </div>
        </div>
      </div>

      <!-- </div> -->

      <div class="row">
        <div class="position-over-time-graph row-graph">
          <h1 class="lowered">Position Over Time</h1>
          <div class="graph full-row-graph">
            <!-- {% include 'graphs/%s/position-over-time-%s.html' % (params.team.names.hyphenated, params.team.names.hyphenated) %} -->
          </div>
        </div>
      </div>

      <div class="row no-bottom-margin" style="margin-bottom: 0">
        <div class="goals-scored-vs-conceded-graph row-graph">
          <h1 class="lowered">Goals Scored and Conceded</h1>
          <div class="graph full-row-graph">
            <!-- {% include 'graphs/%s/goals-scored-and-conceded-%s.html' % (params.team.names.hyphenated, params.team.names.hyphenated) %} -->
          </div>
        </div>
      </div>

      <div class="row">
        <div class="row-graph">
          <div class="clean-sheets graph full-row-graph">
            <!-- {% include 'graphs/%s/clean-sheets-%s.html' % (params.team.names.hyphenated, params.team.names.hyphenated) %} -->
          </div>
        </div>
      </div>

      <div class="season-stats-row">
        <div class="season-stats">
          <div class="season-stat goals-per-game">
            <div class="season-stat-value">
              {data.seasonStats[fullTeamName].xG}
              <div
                class="season-stat-position ssp-{teamData.rank.xG}"
                id="ssp1"
                bind:this={ssp1}
              >
                {teamData.rank.xG}
              </div>
            </div>
            <div class="season-stat-text">goals per game</div>
          </div>
          <div class="season-stat conceded-per-game">
            <div class="season-stat-value">
              {data.seasonStats[fullTeamName].xC}
              <div
                class="season-stat-position ssp-{teamData.rank.xC}"
                id="ssp2"
                bind:this={ssp2}
              >
                {teamData.rank.xC}
              </div>
            </div>
            <div class="season-stat-text">conceded per game</div>
          </div>
          <div class="season-stat clean-sheet-ratio">
            <div class="season-stat-value">
              {data.seasonStats[fullTeamName].cleanSheetRatio}
              <div
                class="season-stat-position ssp-{teamData.rank.cleanSheetRatio}"
                id="ssp3"
                bind:this={ssp3}
              >
                {teamData.rank.cleanSheetRatio}
              </div>
            </div>
            <div class="season-stat-text">clean sheets</div>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="goals-freq-row row-graph">
          <h1>Goals Per Game</h1>
          <div class="two-graphs">
            <div class="graph freq-graph mini-graph">
              <!-- {% include 'graphs/%s/goals-scored-frequency-%s.html' % (params.team.names.hyphenated, params.team.names.hyphenated) %} -->
            </div>
            <div class="graph freq-graph mini-graphh">
              <!-- {% include 'graphs/%s/goals-conceded-frequency-%s.html' % (params.team.names.hyphenated, params.team.names.hyphenated) %} -->
            </div>
          </div>
        </div>
      </div>

      <div class="teams-footer footer-text-colour">
        <a class="ko-fi" href="https://ko-fi.com/C0C069FOI" target="_blank">
          <img class="ko-fi-img" src="img/kofi.png" alt="" />
          <div class="ko-fi-text">Support Me</div>
        </a>
        <div class="teams-footer-bottom">
          {#if data.lastUpdated != null}
            <div class="last-updated">{data.lastUpdated} UTC</div>
          {/if}
          <div class="footer-details">
            <div class="footer-detail footer-text-colour">
              Data provided by
              <a
                class="footer-text-colour underline"
                href="https://www.football-data.org/">football-data.org</a
              >
            </div>
            <div class="footer-detail footer-text-colour">
              Graphs created using
              <a class="footer-text-colour underline" href="https://plotly.com/"
                >Plotly</a
              >
            </div>
            <div class="footer-detail footer-text-colour">
              Font made from
              <a class="footer-text-colour" href="http://www.onlinewebfonts.com"
                >oNline Web Fonts</a
              >
              is licensed by CC BY 3.0
            </div>
          </div>
          <div class="footer-bottom">
            <div class="created-by footer-text-colour">
              Created by Tom Draper
            </div>
            <div class="version footer-text-colour">v2.0</div>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div class="loading-spinner-container">
      <div class="loading-spinner" />
    </div>
  {/if}
</Router>
