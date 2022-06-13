<script>
  import { Router, Link } from "svelte-routing";
  import { onMount } from "svelte";
  
  function toTitleCase(str) {
    return str.toLowerCase().split(' ').map(function (word) {
      return (word.charAt(0).toUpperCase() + word.slice(1));
    }).join(' ');
  }

  function createTeamIdx(team) {
    // Creates camel case team name compatible with API data indexing
    let teamIdx = toTitleCase(team.replace('-', ' ')).replace(' ', '')
    teamIdx = teamIdx.charAt(0).toLowerCase() + teamIdx.slice(1) + 'FC'
    return teamIdx
  }

  function toInitials(fullTeamName) {
    switch(fullTeamName) {
      case 'Brighton and Hove Albion FC':
        return 'BHA'
      case 'Manchester City FC':
        return 'MCI'
      case 'Aston Villa FC':
        return 'AVL'
      case 'Sheffield United FC':
        return 'SHU'
      case 'West Bromwich Albion FC':
        return 'WBA'
      case 'West Ham United':
        return 'WHU'
    }
    return fullTeamName.slice(0, 3).toUpperCase()
  }

  function getCurrentMatchday(data, teamIdx) {
    return Object.keys(data.form[teamIdx]).reduce((a, b) => data.form[teamIdx][a] > data.form[teamIdx][b] ? a : b);

  }

  async function fetchData(address) {
    const response = await fetch(address);
    let json = await response.json();
    return json;
  }

  let fullTeamName = "";
  let teamIdx = "";
  let currentMatchday = 0;
  let data = undefined;
  onMount(() => {
    fetchData('http://127.0.0.1:5000/teams')
    .then(json => {
      fullTeamName = toTitleCase(team.replace('-', ' ')) + ' FC'
      teamIdx = createTeamIdx(team);
      currentMatchday = getCurrentMatchday(json, teamIdx);
      data = json;
    })
    .then(_ => {
      // Generate graphs
      console.log(data);
    });
  })

  let params = {
    team: {
      logo_url: "",
      names: {
        hyphenated: "Liverpool FC"
      }
    },
    form: {
      form: [1, 2, 3, 4, 5],
      won_against_star_team: [1, 2, 3, 4, 5],
      recent_teams_played: [1, 2, 3, 4, 5]
    },
    table_snippet: {
      rows: [[1, 2, 3, 4, 5], [1,2,3,4,5], [1,2,3,4,5], [1,2,3,4,5], [1,2,3,4,5], [1,2,3,4,5]],
    },
    next_game: {
      prev_meetings: [1, 2, 3, 4, 5],
      opp_team: {
        names: ""
      }
    },
    prediction: {

    },
    season_stats: {
      goals_per_game: {
        ratio: 0,
      },
      conceded_per_game: {
        ratio: 0,
      },
      clean_sheets: {
        ratio: 0,
      }

    }
  }


  export let team;
</script>

<Router>
  <div class="header" style="background-color: var(--{ team });">
    <!-- <NavLink id="back-button" class="main-link" to="/" /> -->
    <Link to="/ " >
      <div id="back-button" class="main-link"></div>
    </Link>
    <Link  to="/{team}">
      <div class="main-link title no-decoration" style="color: var(--{ team + '-secondary' });">
        { fullTeamName }
      </div>
    </Link>

  </div>

  {#if data != undefined}
    <div class="page-content">
      <div class="row">
        <div class="row-left position-and-badge"
          style="background-image: url('{ data.logoURLs[teamIdx] }'); background-repeat: no-repeat; background-size: auto 450px; background-position: right center;">
          <div class="position">{ data.standings[teamIdx][data.currentSeason].position }</div>
        </div>
        <div class="fixtures-graph row-graph">
          <h1 class="lowered">Fixtures</h1>
          <!-- Not included in an iframe to ensure it loads before page is rendered -->
          <div class="graph mini-graph">
            <!-- {% include 'graphs/%s/fixtures-%s.html' % (params.team.names.hyphenated, params.team.names.hyphenated) %} -->
          </div>
        </div>
      </div>

      <div class="row">
        <div class="row-left form-details">
          <div class="current-form-row">
            <div class="icon pos-0 { data.form[teamIdx][currentMatchday].form5.charAt(0) } { data.form[teamIdx][currentMatchday].beatStarTeam ? 'star-team' : '' }"></div>
            <div class="icon pos-1 { data.form[teamIdx][currentMatchday].form5.charAt(1) } { params.form.won_against_star_team[1] }"></div>
            <div class="icon pos-2 { data.form[teamIdx][currentMatchday].form5.charAt(2) } { params.form.won_against_star_team[2] }"></div>
            <div class="icon pos-3 { data.form[teamIdx][currentMatchday].form5.charAt(3) } { params.form.won_against_star_team[3] }"></div>
            <div class="icon pos-4 { data.form[teamIdx][currentMatchday].form5.charAt(4) } { params.form.won_against_star_team[4] }"></div>
          </div>
          <div class="current-form-row">
            <div class="icon-name pos-0">
              { toInitials(data.form[teamIdx][currentMatchday].team) }
            </div>
            <div class="icon-name pos-1">
              { toInitials(data.form[teamIdx][currentMatchday-1].team) }
            </div>
            <div class="icon-name pos-2">
              { toInitials(data.form[teamIdx][currentMatchday-2].team) }
            </div>
            <div class="icon-name pos-3">
              { toInitials(data.form[teamIdx][currentMatchday-3].team) }
            </div>
            <div class="icon-name pos-4">
              { toInitials(data.form[teamIdx][currentMatchday-4].team) }
            </div>
          </div>
          <div class="current-form">
            Current form: { data.form.rating }%
          </div>

          <div class="table-snippet">
            <div class="divider"></div>
            <div class="table-row">
              <div class="table-element table-position column-title"></div>
              <div class="table-element table-team-name column-title">Team</div>
              <div class="table-element table-gd column-title">GD</div>
              <div class="table-element table-points column-title">Points</div>
            </div>

            {#each Array(params.table_snippet.rows.length) as _, i}
            <!-- Divider -->
              {#if i == 0}
                {#if i != params.table_snippet.team_table_idx}
                  <div id="divider"></div>
                {/if}
              {:else if i-1 != params.table_snippet.team_table_idx && i != params.table_snippet.team_table_idx}
                <div id="divider"></div>
              {/if}

              <!-- Row of table -->
              {#if i == params.table_snippet.team_table_idx}
                <!-- Highlighted row for the team of the current page -->
                <div class="table-row this-team" style="background-color: var(--{ params.team.names.hyphenated });">
                  <div class="table-element table-position this-team"
                    style="color: var(--{ params.team.names.hyphenated }-secondary);">
                    { params.table_snippet.rows[i][0] }
                  </div>
                  <div class="table-element table-team-name this-team"
                    style="color: var(--{ params.team.names.hyphenated }-secondary);">
                    { params.table_snippet.rows[i][1] }
                  </div>
                  <div class="table-element table-gd this-team"
                    style="color: var(--{ params.team.names.hyphenated }-secondary);">
                    { params.table_snippet.rows[i][2] }
                  </div>
                  <div class="table-element table-points this-team"
                    style="color: var(--{ params.team.names.hyphenated }-secondary);">
                    { params.table_snippet.rows[i][3] }
                  </div>
                </div>
              {:else}
                <!-- Plain row -->
                <div class="table-row">
                  <div class="table-element table-position">
                    { params.table_snippet.rows[i][0] }
                  </div>
                  <div class="table-element table-team-name">
                    { params.table_snippet.rows[i][1] }
                  </div>
                  <div class="table-element table-gd">
                    { params.table_snippet.rows[i][2] }
                  </div>
                  <div class="table-element table-points">
                    { params.table_snippet.rows[i][3] }
                  </div>
                </div>
              {/if}
            {/each}
            {#if params.table_snippet.team_table_idx != 6}
              <div id="divider"></div>
            {/if}
          </div>
        </div>

        <div class="next-game-prediction row-graph" style="border: 6px solid var(--{ params.next_game.opp_team.names.hyphenated });">
          {#if params.next_game.opp_team.names.hyphenated != ''}
            <!-- Pre or mid season -->
            <div class="next-game-title" style="background-color: var(--{ params.next_game.opp_team.names.hyphenated });">
              <h1 class="next-game-title-text"
                style="color: var(--{ params.next_game.opp_team.names.hyphenated  }-secondary);">
                Next Game:
                <a href="/{params.next_game.opp_team.names.hyphenated}" class="no-decoration" style="color: inherit">{ params.next_game.opp_team.names.name }</a><span class="parenthesis">(</span>{ params.next_game.home_away}<span class="parenthesis">)</span>
              </h1>
            </div>
          {:else}
            <!-- Season complete -->
            <div class="next-game-season-complete">
              <h1 class="next-game-title-text">
                { params.season }/{ params.season+1 } SEASON COMPLETE
              </h1>
            </div>
          {/if}
        </div>

        {#if params.next_game.opp_team.names.hyphenated != ''}
        <div class="next-game-values">
          <div class="predictions-and-logo">
            <div class="next-game-logo opposition-badge" style="background-image: url('{ params.next_game.opp_team.logo_url }');
                            background-repeat: no-repeat;
                            background-size: contain;
                            background-position: center;"></div>
            <div class="predictions">
              <div class="next-game-item">
                Current form:
                <b>{ params.next_game.opp_team.form_rating }%</b>
              </div>
              <div class="next-game-item">
                Score prediction
                <br />
                <a class="predictions-link" href="/predictions">
                  <b>{ params.prediction.scoreline }</b>
                </a>
                <br />
                <span class="accuracy-item">
                  Predicting with accuracy:
                  <b>{ params.prediction.accuracy }%</b></span><br />
                <div class="accuracy-item">
                  General results accuracy:
                  <b>{ params.prediction.results_accuracy }%</b>
                </div>
              </div>
            </div>
          </div>
          <div class="past-results">
            {#if params.next_game.prev_meetings.length == 0}
            <div class="next-game-item prev-results-title">
              No Previous Results
            </div>
            {:else}
            <div class="next-game-item prev-results-title">
              Previous Results
            </div>
            {/if}

            <!-- Display table of previous results against the next team this team is playing -->
            {#each params.next_game.prev_meetings as prev_meeting}
            <div class="next-game-item { prev_meeting }">
              <div class="past-result">
                <div class="home-team">{ prev_meeting }</div>
                <div class="score">
                  { prev_meeting } - { prev_meeting}
                </div>
                <div class="away-team">{ prev_meeting }</div>
              </div>
              <div style="clear: both"></div>
              <div class="past-result-date">
                { prev_meeting }
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
              { params.season_stats.goals_per_game.ratio }
              <div class="season-stat-position ssp-{ params.season_stats.goals_per_game.position }" id="ssp2">
                { params.season_stats.goals_per_game.position }
              </div>
            </div>
            <div class="season-stat-text">goals per game</div>
          </div>
          <div class="season-stat conceded-per-game">
            <div class="season-stat-value">
              { params.season_stats.conceded_per_game.ratio }
              <div class="season-stat-position ssp-{ params.season_stats.conceded_per_game.position }" id="ssp3">
                { params.season_stats.conceded_per_game.position }
              </div>
            </div>
            <div class="season-stat-text">conceded per game</div>
          </div>
          <div class="season-stat clean-sheet-ratio">
            <div class="season-stat-value">
              { params.season_stats.clean_sheets.ratio }
              <div class="season-stat-position ssp-{ params.season_stats.clean_sheets.position }" id="ssp1">
                { params.season_stats.clean_sheets.position }
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
        <!-- <script type="text/javascript" src="https://storage.ko-fi.com/cdn/widget/Widget_2.js"></script> -->
        <!-- <script type="text/javascript">
          kofiwidget2.init("Support Me", "#d9534f", "C0C069FOI");
          kofiwidget2.draw();
        </script> -->
        <div class="teams-footer-bottom">
          {#if params.last_updated != null}
            <div class="last-updated">{ params.last_updated } UTC</div>
          {/if}
          <div class="footer-details">
            <div class="footer-detail footer-text-colour">
              Data provided by
              <a class="footer-text-colour underline" href="https://www.football-data.org/">football-data.org</a>
            </div>
            <div class="footer-detail footer-text-colour">
              Graphs created using
              <a class="footer-text-colour underline" href="https://plotly.com/">Plotly</a>
            </div>
            <div class="footer-detail footer-text-colour">
              Font made from
              <a class="footer-text-colour" href="http://www.onlinewebfonts.com">oNline Web Fonts</a>
              is licensed by CC BY 3.0
            </div>
          </div>
          <div class="footer-bottom">
            <div class="created-by footer-text-colour">
              Created by Tom Draper
            </div>
            <div class="version footer-text-colour">v1.0</div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</Router>