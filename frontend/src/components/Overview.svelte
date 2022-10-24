<script lang="ts">
  import { onMount } from "svelte";
  import { get_spread_update } from "svelte/internal";

  function isToday(date: Date) {
    let now = new Date();
    return date.getDate() == now.getDate() && date.getMonth() == now.getMonth();
  }

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
    console.log(standings)
    return standings;
  }

  let upcoming: UpcomingMatch[];
  let standings: Standings[];
  onMount(() => {
    upcoming = upcomingMatches();
    standings = standingsTable();
    console.log(upcoming);
  });

  export let data: TeamData, toInitials: Function;
</script>

<div id="page-content">
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
  <div class="standings-container">
    {#if standings != undefined}
      <div class="standings-table">
        <div class="standings-title">Standings</div>
        <div class="standings">
          <div class="row">
            <div class="position"></div>
            <div class="team-name">
              
            </div>
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
            <div class="row {i % 2 == 0 ? 'grey-row' : ''} {i < 4 ? 'cl': ''} {i > 3 && i < 6 ? 'el' : ''} {i > 16 ? 'relegation' : ''}">
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

<style scoped>
  #page-content {
    display: flex;
  }
  .upcoming-matches-container {
    width: min(40%, 550px);
  }
  .upcoming-matches {
    width: 90%;
  }
  .upcoming-match {
    display: flex;
    margin-bottom: 12px;
  }
  .upcoming-match-date {
    text-align: center;
    margin: 0.9em 0 0.4em 0;
  }
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
    padding: 3px 10px;
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
  }
  .standings {
    margin: 10px auto 0;
    width: fit-content;
  }
  .row {
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
</style>
