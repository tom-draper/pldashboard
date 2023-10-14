<script lang="ts">
  import { onMount } from 'svelte';
  import { toInitials } from '../../lib/team';
  import { teamStyle } from '../../lib/format';
  // import OverviewFooter from "./Footer.svelte";

  type UpcomingMatch = {
    time: Date;
    home: string;
    away: string;
  };

  function upcomingMatches(): UpcomingMatch[] {
    const upcoming: UpcomingMatch[] = [];
    for (const team in data.upcoming) {
      const date = new Date(data.upcoming[team].date);
      if (!data.upcoming[team].atHome) {
        continue;
      }
      upcoming.push({
        time: date,
        home: team,
        away: data.upcoming[team].nextTeam,
      });
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
    const standings: Standings[] = [];
    for (const team in data.standings) {
      const row = Object(data.standings[team][data._id]);
      row.team = team;
      standings.push(row);
    }
    standings.sort((a, b) => {
      return a.position - b.position;
    });
    return standings;
  }

  function applyRatingFixturesScaling() {
    if (fixturesScaling === 'rating') {
      return;
    }
    fixturesScaling = 'rating';

    for (const teamFixtures of fixtures) {
      for (const match of teamFixtures.matches) {
        const homeAdvantage = match.atHome
          ? 0
          : data.homeAdvantages[match.team].totalHomeAdvantage;
        match.colour = fixtureColourSkewed(
          data.teamRatings[match.team].totalRating + homeAdvantage
        );
      }
    }
    fixtures = fixtures;
  }

  function applyRatingFormScaling() {
    if (fixturesScaling === 'form') {
      return;
    }
    fixturesScaling = 'form';

    for (const teamFixtures of fixtures) {
      for (const match of teamFixtures.matches) {
        let form = 0.5;
        const matchdays = Object.keys(
          data.form[teamFixtures.team][data._id]
        ).reverse();
        const homeAdvantage = match.atHome
          ? 0
          : data.homeAdvantages[match.team].totalHomeAdvantage;
        for (const matchday of matchdays) {
          if (data.form[match.team][data._id][matchday].formRating5 != null) {
            form = data.form[match.team][data._id][matchday].formRating5;
          }
        }
        match.colour = fixtureColour(form + homeAdvantage);
      }
    }
    fixtures = fixtures;
  }

  type Fixtures = {
    team: string;
    matches: {
      team: string;
      date: string;
      atHome: boolean;
      status: string;
      colour: string;
    }[];
  };

  function fixturesTable(standings: Standings[]): Fixtures[] {
    const fixtures = [];
    for (const row of standings) {
      const matches = [];
      for (const matchday in data.fixtures[row.team]) {
        const match = data.fixtures[row.team][matchday];
        const homeAdvantage = match.atHome
          ? 0
          : data.homeAdvantages[match.team].totalHomeAdvantage;
        matches.push({
          team: match.team,
          date: match.date,
          atHome: match.atHome,
          status: match.status,
          colour: fixtureColourSkewed(
            data.teamRatings[match.team].totalRating + homeAdvantage
          ),
        });
      }
      fixtures.push({
        team: row.team,
        matches: matches,
      });
    }
    return fixtures;
  }

  function fixtureColourSkewed(scaleVal: number) {
    if (scaleVal < 0.05) {
      return '#00fe87';
    } else if (scaleVal < 0.1) {
      return '#63fb6e';
    } else if (scaleVal < 0.15) {
      return '#8df755';
    } else if (scaleVal < 0.2) {
      return '#aef23e';
    } else if (scaleVal < 0.25) {
      return '#cbec27';
    } else if (scaleVal < 0.3) {
      return '#e6e50f';
    } else if (scaleVal < 0.35) {
      return '#ffdd00';
    } else if (scaleVal < 0.4) {
      return '#ffc400';
    } else if (scaleVal < 0.45) {
      return '#ffab00';
    } else if (scaleVal < 0.5) {
      return '#ff9000';
    } else if (scaleVal < 0.55) {
      return '#ff7400';
    } else if (scaleVal < 0.6) {
      return '#ff5618';
    } else {
      return '#f83027';
    }
  }

  function fixtureColour(scaleVal: number) {
    if (scaleVal < 0.2) {
      return '#00fe87';
    } else if (scaleVal < 0.25) {
      return '#63fb6e';
    } else if (scaleVal < 0.35) {
      return '#8df755';
    } else if (scaleVal < 0.4) {
      return '#aef23e';
    } else if (scaleVal < 0.45) {
      return '#cbec27';
    } else if (scaleVal < 0.5) {
      return '#e6e50f';
    } else if (scaleVal < 0.55) {
      return '#ffdd00';
    } else if (scaleVal < 0.6) {
      return '#ffc400';
    } else if (scaleVal < 0.65) {
      return '#ffab00';
    } else if (scaleVal < 0.7) {
      return '#ff9000';
    } else if (scaleVal < 0.75) {
      return '#ff7400';
    } else if (scaleVal < 0.8) {
      return '#ff5618';
    } else {
      return '#f83027';
    }
  }

  let upcoming: UpcomingMatch[];
  let standings: Standings[];
  let fixtures: Fixtures[];
  $: fixtures;
  let fixturesScaling = 'rating';
  onMount(() => {
    upcoming = upcomingMatches();
    standings = standingsTable();
    fixtures = fixturesTable(standings);
  });

  export let data;
</script>

<div id="page-content">
  <div class="row">
    <div class="left">
      <div class="upcoming-matches-container">
        {#if upcoming != undefined}
          <div class="upcoming-matches">
            <div class="upcoming-title">Upcoming</div>
            {#each upcoming as match, i}
              {#if i === 0 || match.time.getDate() != upcoming[i - 1].time.getDate()}
                <div class="upcoming-match-date">
                  {match.time.toLocaleDateString('en-GB', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              {/if}
              <div class="upcoming-match">
                <div class="upcoming-match-teams">
                  <div
                    class="upcoming-match-home"
                    style={teamStyle(match.home)}
                  >
                    {toInitials(match.home)}
                  </div>
                  <div
                    class="upcoming-match-away"
                    style={teamStyle(match.away)}
                  >
                    {toInitials(match.away)}
                  </div>
                </div>
              </div>
              <div class="upcoming-match-time-container">
                <div class="upcoming-match-time">
                  {match.time.toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
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
              <div class="standings-position" />
              <div class="standings-team-name" />
              <div class="standings-won bold">W</div>
              <div class="standings-drawn bold">D</div>
              <div class="standings-lost bold">L</div>
              <div class="standings-gf bold">GF</div>
              <div class="standings-ga bold">GA</div>
              <div class="standings-gd bold">GD</div>
              <div class="standings-played bold">Played</div>
              <div class="standings-points bold">Points</div>
              <div class="standings-rating bold">Rating</div>
              <div class="standings-form bold">Form</div>
            </div>
            {#each standings as row, i}
              <div
                class="table-row {i % 2 === 0 ? 'grey-row' : ''} {i < 4
                  ? 'cl'
                  : ''} {i > 3 && i < 6 ? 'el' : ''} {i > 16
                  ? 'relegation'
                  : ''}"
              >
                <div class="standings-position">
                  {row.position}
                </div>
                <div class="standings-team-name">
                  {row.team}
                </div>
                <div class="standings-won">
                  {row.won}
                </div>
                <div class="standings-drawn">
                  {row.drawn}
                </div>
                <div class="standings-lost">
                  {row.lost}
                </div>
                <div class="standings-gf">
                  {row.gF}
                </div>
                <div class="standings-ga">
                  {row.gA}
                </div>
                <div class="standings-gd">
                  {row.gD}
                </div>
                <div class="standings-played">
                  {row.played}
                </div>
                <div class="standings-points">
                  {row.points}
                </div>
                <div class="standings-rating">
                  {data.teamRatings[row.team].totalRating.toFixed(2)}
                </div>
                <div class="standings-form">
                  {Object.keys(data.form[row.team][data._id]).length > 0 &&
                  data.form[row.team][data._id][
                    Math.max(
                      ...Object.keys(data.form[row.team][data._id]).map((x) =>
                        parseInt(x)
                      )
                    )
                  ] != undefined &&
                  data.form[row.team][data._id][
                    Math.max(
                      ...Object.keys(data.form[row.team][data._id]).map((x) =>
                        parseInt(x)
                      )
                    )
                  ].formRating5 != null
                    ? data.form[row.team][data._id][
                        Math.max(
                          ...Object.keys(data.form[row.team][data._id]).map(
                            (x) => parseInt(x)
                          )
                        )
                      ].formRating5.toFixed(2)
                    : ''}
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
            <button
              id="rating-scale-btn"
              class="scale-btn {fixturesScaling === 'rating'
                ? 'scaling-selected'
                : ''}"
              on:click={applyRatingFixturesScaling}
            >
              Rating
            </button>
          </div>
          <div class="scale-team-form">
            <button
              id="form-scale-btn"
              class="scale-btn {fixturesScaling === 'form'
                ? 'scaling-selected'
                : ''}"
              on:click={applyRatingFormScaling}
            >
              Form
            </button>
          </div>
        </div>
        <div class="fixtures-table">
          <div class="fixtures-teams-container">
            {#each fixtures as row, i}
              <div class="fixtures-table-row">
                <div
                  class="fixtures-team"
                  style="{teamStyle(row.team)} {i === 0 ? 'border-top: 2px solid black; border-radius: 4px 0 0' : i === fixtures.length - 1 ? 'border-radius: 0 0 0 4px;' : ''}">
                  {toInitials(row.team)}
                </div>
              </div>
            {/each}
          </div>
          <div class="fixtures-matches-container">
            <div class="fixtures-table-row">
              <div class="fixtures-matches">
                {#each Array(38) as _, i}
                  <div class="match">{i + 1}</div>
                {/each}
              </div>
            </div>
            {#each fixtures as row, _}
              <div class="fixtures-table-row">
                <div class="fixtures-matches">
                  {#each row.matches as match, i}
                    <div
                      class="match"
                      style="background: {match.colour}; {match.status ==
                      'FINISHED'
                        ? 'filter: grayscale(100%)'
                        : ''} {i === row.matches.length - 1
                        ? 'border-right: 2px solid black'
                        : ''}"
                      title={match.date}
                    >
                      {`${toInitials(match.team)} (${
                        match.atHome ? 'H' : 'A'
                      }`})
                    </div>
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

<style scoped>
  #page-content {
    margin-top: 3em;
    position: relative;
  }
  .row {
    display: flex;
    margin-bottom: 2em;
  }
  .left {
    width: min(40%, 500px);
  }
  .upcoming-matches {
    position: relative;
    margin-left: 40px;
  }
  .upcoming-match {
    display: flex;
    margin-bottom: 8px;
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

  .upcoming-match-time-container {
    display: grid;
    place-items: center;
    position: absolute;
    margin-top: -31px;
    width: 100%;
  }
  .upcoming-match-time {
    background: #ffffffa1;
    padding: 1px 4px;
    border-radius: 2px;
    font-size: 13px;
    text-align: right;
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
    flex-grow: 1;
    margin: 0 40px 0 40px;
  }
  .standings {
    margin: 10px auto 0;
  }
  .table-row {
    display: flex;
    padding: 4px 20px 4px 10px;
    border-radius: 4px;
  }
  .standings-position {
    width: 20px;
    margin-right: 15px;
    text-align: right;
  }
  .standings-team-name {
    width: 210px;
  }
  .bold {
    font-weight: 800;
  }
  .standings-won,
  .standings-drawn,
  .standings-lost {
    flex: 1;
    text-align: right;
  }
  .standings-gf,
  .standings-ga,
  .standings-gd {
    flex: 1;
    text-align: right;
  }
  .standings-rating,
  .standings-form,
  .standings-played,
  .standings-points {
    flex: 1;
    text-align: right;
  }
  .standings-points {
    margin-right: 10%;
  }
  .grey-row {
    background: rgb(236, 236, 236);
  }
  .cl {
    background: rgba(0, 254, 135, 0.6);
  }
  .cl.grey-row {
    background: rgb(0, 254, 135, 1);
  }
  .el {
    background: rgba(17, 182, 208, 0.7);
    background: rgba(2, 238, 255, 0.6);
  }
  .el.grey-row {
    background: rgba(17, 182, 208, 1);
    background: #02eeff;
  }
  .relegation {
    background: rgba(248, 48, 39, 0.7);
  }
  .relegation.grey-row {
    background: rgb(248, 48, 39, 1);
  }
  .fixtures {
    position: relative;
    width: calc(100vw - 230px);
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
    border-right: 2px solid black;
    border-left: 2px solid black;
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

  @media only screen and (max-width: 1200px) {
    .fixtures {
      width: 100vw;
    }
    .standings-points {
      margin: 0;
    }
  }
</style>
