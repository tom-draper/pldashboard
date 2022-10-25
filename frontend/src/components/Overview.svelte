<script lang="ts">
  import { onMount } from "svelte";
  import OverviewFooter from "../components/OverviewFooter.svelte";

  type UpcomingMatch = {
    time: Date;
    home: string;
    away: string;
  };

  function upcomingMatches(): UpcomingMatch[] {
    let upcoming: UpcomingMatch[] = [];
    for (let team in data.upcoming) {
      let date = new Date(data.upcoming[team].date);
      let atHome = data.upcoming[team].atHome;
      if (atHome) {
        upcoming.push({
          time: date,
          home: team,
          away: data.upcoming[team].nextTeam,
        });
      }
    }
    upcoming.sort((a: UpcomingMatch, b: UpcomingMatch) => {
      //@ts-ignore
      return a.time - b.time;
    });
    return upcoming;
  }

  type Standings = {
    team: string;
    position: number;
    played: number;
    points: number;
    won: number;
    lost: number;
    drawn: number;
    gA: number;
    gD: number;
    gF: number;
  };

  function standingsTable(): Standings[] {
    let standings: Standings[] = [];
    for (let team in data.standings) {
      let row = Object(data.standings[team][data._id]);
      row.team = team;
      standings.push(row);
    }
    standings.sort((a, b) => {
      return a.position - b.position;
    });
    return standings;
  }

  function applyRatingFixturesScaling() {
    if (fixturesScaling == 'rating') {
      return
    }
    fixturesScaling = 'rating'

    for (let teamFixtures of fixtures) {
      for (let match of teamFixtures.matches) {
        match.colour = fixtureColourSkewed(data.teamRatings[match.team].totalRating);
      }
    }
    fixtures = fixtures
  }
  
  function applyRatingFormScaling() {
    if (fixturesScaling == 'form') {
      return
    }
    fixturesScaling = 'form'
    
    for (let teamFixtures of fixtures) {
      for (let match of teamFixtures.matches) {
        let form = 0.5;
        let matchdays = Object.keys(data.form[teamFixtures.team][data._id]).reverse()
        for (let matchday of matchdays) {
          if (data.form[match.team][data._id][matchday].formRating5 != null) {
            form = data.form[match.team][data._id][matchday].formRating5; 
          }
        }
        match.colour = fixtureColour(form);
      }
    }
    console.log(fixtures)
    fixtures = fixtures
  }

  type Fixtures = {
    team: string,
    matches: {
      team: string,
      atHome: boolean,
      status: string,
      colour: string
    }[]
  }

  function fixturesTable(standings: Standings[]): Fixtures[] {
    let fixtures = [];
    for (let row of standings) {
      let matches = [];
      for (let matchday in data.fixtures[row.team]) {
        let match = data.fixtures[row.team][matchday]
        matches.push({
          team: match.team,
          atHome: match.atHome,
          status: match.status,
          colour: fixtureColourSkewed(data.teamRatings[match.team].totalRating)
        })
      }
      fixtures.push({
        team: row.team,
        matches: matches
      })
    }
    return fixtures
  }

  function fixtureColourSkewed(scaleVal: number) {
    if (scaleVal < 0.05) {
      return "#00fe87"
    } else if (scaleVal < 0.1) {
      return "#63fb6e"
    } else if (scaleVal < 0.15) {
      return "#8df755"
    } else if (scaleVal < 0.2) {
      return "#aef23e"
    } else if (scaleVal < 0.25) {
      return "#cbec27"
    } else if (scaleVal < 0.3) {
      return "#e6e50f"
    } else if (scaleVal < 0.35) {
      return "#ffdd00"
    } else if (scaleVal < 0.4) {
      return "#ffc400"
    } else if (scaleVal < 0.45) {
      return "#ffab00"
    } else if (scaleVal < 0.5) {
      return "#ff9000"
    } else if (scaleVal < 0.55) {
      return "#ff7400"
    } else if (scaleVal < 0.6) {
      return "#ff5618"
    } else  {
      return "#f83027"
    }
  }

  function fixtureColour(scaleVal: number) {
    if (scaleVal < 0.2) {
      return "#00fe87"
    } else if (scaleVal < 0.25) {
      return "#63fb6e"
    } else if (scaleVal < 0.35) {
      return "#8df755"
    } else if (scaleVal < 0.4) {
      return "#aef23e"
    } else if (scaleVal < 0.45) {
      return "#cbec27"
    } else if (scaleVal < 0.5) {
      return "#e6e50f"
    } else if (scaleVal < 0.55) {
      return "#ffdd00"
    } else if (scaleVal < 0.60) {
      return "#ffc400"
    } else if (scaleVal < 0.65) {
      return "#ffab00"
    } else if (scaleVal < 0.7) {
      return "#ff9000"
    } else if (scaleVal < 0.75) {
      return "#ff7400"
    } else if (scaleVal < 0.8) {
      return "#ff5618"
    } else  {
      return "#f83027"
    }
  }

  function updateClock() {
    currentTime = new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            })
    setTimeout(updateClock, 1000)
  }

  let upcoming: UpcomingMatch[];
  let standings: Standings[];
  let fixtures: Fixtures[];
  $: fixtures;
  let fixturesScaling = "rating"
  let currentTime: string;
  onMount(() => {
    upcoming = upcomingMatches();
    standings = standingsTable();
    fixtures = fixturesTable(standings);
    updateClock()
    console.log(upcoming);
  });

  export let data: TeamData, toInitials: Function;
</script>

<div id="page-content">
  <div class="row">
    <div class="left">
      <div class="upcoming-matches-container">
        {#if upcoming != undefined}
          <div class="upcoming-matches">
            <div class="upcoming-title">Upcoming</div>
            {#each upcoming as match, i}
              {#if i == 0 || match.time.getDate() != upcoming[i - 1].time.getDate()}
                <div class="upcoming-match-date">
                  {match.time.toLocaleDateString("en-GB", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              {/if}
              <div class="upcoming-match">
                <div class="upcoming-match-time">
                  {match.time.toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div class="upcoming-match-teams">
                  <div
                    class="upcoming-match-home"
                    style="background: var(--{match.home
                      .toLowerCase()
                      .replace(/ /g, '-')}); color: var(--{match.home
                      .toLowerCase()
                      .replace(/ /g, '-')}-secondary)"
                  >
                    {toInitials(match.home)}
                  </div>
                  <div
                    class="upcoming-match-away"
                    style="background: var(--{match.away
                      .toLowerCase()
                      .replace(/ /g, '-')}); color: var(--{match.away
                      .toLowerCase()
                      .replace(/ /g, '-')}-secondary)"
                  >
                    {toInitials(match.away)}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
    <div class="standings-container">
      {#if standings != undefined}
        <div class="standings-table">
          <div class="standings-title">Standings</div>
          <div class="standings">
            <div class="table-row">
              <div class="position" />
              <div class="team-name" />
              <div class="won bold">W</div>
              <div class="drawn bold">D</div>
              <div class="lost bold">L</div>
              <div class="gf bold">GF</div>
              <div class="ga bold">GA</div>
              <div class="gd bold">GD</div>
              <div class="played bold">Played</div>
              <div class="points bold">Points</div>
            </div>
            {#each standings as row, i}
              <div
                class="table-row {i % 2 == 0 ? 'grey-row' : ''} {i < 4 ? 'cl' : ''} {i >
                  3 && i < 6
                  ? 'el'
                  : ''} {i > 16 ? 'relegation' : ''}"
              >
                <div class="position">
                  {row.position}
                </div>
                <div class="team-name">
                  {row.team}
                </div>
                <div class="won">
                  {row.won}
                </div>
                <div class="drawn">
                  {row.drawn}
                </div>
                <div class="lost">
                  {row.lost}
                </div>
                <div class="gf">
                  {row.gF}
                </div>
                <div class="ga">
                  {row.gA}
                </div>
                <div class="gd">
                  {row.gD}
                </div>
                <div class="played">
                  {row.played}
                </div>
                <div class="points">
                  {row.points}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
  <div class="row">
    <div class="fixtures">
      <div class="fixtures-title">Fixtures</div>
      {#if fixtures != undefined}
      <div class="scale-btns">
        <div class="scale-team-ratings">
          <button id="rating-scale-btn" class="scale-btn {fixturesScaling == 'rating' ? 'scaling-selected' : ''}"
            on:click={applyRatingFixturesScaling}>
            Rating
          </button>
        </div>
        <div class="scale-team-form">
          <button id="form-scale-btn" class="scale-btn {fixturesScaling == 'form' ? 'scaling-selected' : ''}"
            on:click={applyRatingFormScaling}>
            Form
          </button>
        </div>
      </div>
      <div class="fixtures-table">
          <div class="fixtures-teams-container">
            {#each fixtures as row, i}
              <div class="fixtures-table-row">
                <div class="fixtures-team"
                style="background: var(--{row.team
                      .toLowerCase()
                      .replace(/ /g, '-')}); color: var(--{row.team
                      .toLowerCase()
                      .replace(/ /g, '-')}-secondary);
                      {i == 0 ? 'border-top: 2px solid black' : ''}">
                  {toInitials(row.team)}
                </div>
              </div>
            {/each}
          </div>
          <div class="fixtures-matches-container">
            <div class="fixtures-table-row">
              <div class="fixtures-matches">
                {#each Array(38) as _, i}
                  <div class="match">{i+1}</div>
                {/each}
              </div>
            </div>
            {#each fixtures as row, _}
              <div class="fixtures-table-row">
                <div class="fixtures-matches">
                  {#each row.matches as match, i}
                    <div 
                    class="match" 
                    style="background: {match.colour}; {match.status == 'FINISHED' ? 'filter: grayscale(100%)' : ''} {i == row.matches.length - 1 ? 'border-right: 3px solid black' : ''}">{`${toInitials(match.team)} (${match.atHome ? 'H' : 'A'}`})</div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
<OverviewFooter />

<style scoped>
  #page-content {
    margin-top: 3em;
  }
  .row {
    display: flex;
    margin-bottom: 2em;
  }
  .summary {
    padding: 30px 30px;
    border-radius: 9px;
    margin: 0 0 37px 65px;
    font-size: 1.2em;
    background: var(--purple);
    color: white;
  }
  .matchday {
    margin-left: auto;
    margin-top: 10px;
  }
  .left {
    width: min(40%, 500px);
  }
  .upcoming-match {
    display: flex;
    margin-bottom: 12px;
  }
  .upcoming-match-date {
    text-align: center;
    margin: 0.9em 0 0.4em 0;
  }
  .fixtures-title,
  .standings-title,
  .upcoming-title {
    font-size: 2em;
    font-weight: 800;
    text-align: center;
  }
  .upcoming-match-date,
  .upcoming-title {
    margin-left: 90px;
  }
  .upcoming-match-time {
    font-size: 13px;
    text-align: right;
    margin: auto 10px auto auto;
    width: 60px;
  }
  .upcoming-match-teams {
    display: flex;
    flex-grow: 1;
  }
  .upcoming-match-home,
  .upcoming-match-away {
    flex: 1;
    padding: 4px 10px;
  }
  .upcoming-match-home {
    border-radius: 4px 0 0 4px;
  }
  .upcoming-match-away {
    text-align: right;
    border-radius: 0 4px 4px 0;
  }
  .standings-container {
    /* flex-grow: 1; */
    margin: 0 40px;
  }
  .standings {
    margin: 10px auto 0;
    width: fit-content;
  }
  .table-row {
    display: flex;
    padding: 4px 20px 4px 10px;
    border-radius: 4px;
  }
  .position {
    width: 20px;
    margin-right: 15px;
    text-align: right;
  }
  .team-name {
    width: 210px;
  }
  .bold {
    font-weight: 800;
  }
  .won,
  .drawn,
  .lost {
    width: 30px;
    text-align: right;
  }
  .gf,
  .ga,
  .gd {
    width: 40px;
    text-align: right;
  }
  .played,
  .points {
    width: 65px;
    text-align: right;
  }
  .grey-row {
    background: rgb(236, 236, 236);
  }
  .cl {
    background: rgba(0, 254, 135, 0.25);
  }
  .cl.grey-row {
    background: rgb(0, 254, 135, 0.6);
  }
  .el {
    background: rgba(17, 182, 208, 0.25);
  }
  .el.grey-row {
    background: rgba(17, 182, 208, 0.6);
  }
  .relegation {
    background: rgba(248, 48, 39, 0.25);
  }
  .relegation.grey-row {
    background: rgb(248, 48, 39, 0.6);
  }
  .fixtures {
    width: calc(100% - 220px);
    position: relative;
  }
  .fixtures-table {
    display: flex;
    margin: 20px 30px 0 30px;
  }
  .fixtures-matches-container {
    overflow-x: scroll;
    display: block;
  }
  .fixtures-teams-container {
    margin-top: 25px;
  }
  .fixtures-table-row {
    display: flex;
  }
  .fixtures-team {
    min-width: 60px;
    text-align: center;
    border-right: 3px solid black;
    border-left: 3px solid black;
  }
  .fixtures-matches {
    display: flex;
  }
  .fixtures-team,
  .match {
    padding: 3px 8px;
  }
  .match {
    text-align: center;
    width: 60px;
    border-bottom: 2px solid black;
  }
  .fixtures-team {
    border-bottom: 2px solid black;
  }
  .scale-btns {
    position: absolute;
    top: 6px;
    right: 30px;
    display: flex;
  }
  .scale-team-ratings,
  .scale-team-form {
    padding: 5px 0;
  }
  .scale-team-ratings {
    padding-right: 10px;
  }
  .scaling-selected {
    background: var(--purple);
    color: var(--green);
  }
  .scale-btn {
    border-radius: 4px;
    cursor: pointer;
  }
</style>
