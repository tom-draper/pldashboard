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
      return a.time - b.time
    })
    return upcoming;
  }

  let upcoming: UpcomingMatch[];
  onMount(() => {
    upcoming = upcomingMatches();
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
          {#if i == 0 || match.time.getDate() != upcoming[i-1].time.getDate()}
            <div class="upcoming-match-date">
              {match.time.toLocaleDateString("en-GB", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          {/if}
            <div class="upcoming-match">
              <div class="upcoming-match-time">
                {match.time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
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

<style scoped>
  .upcoming-matches-container {
    width: max(40%, 400px);
  }
  .upcoming-matches {
    width: 90%;
    /* margin: auto; */
  }
  .upcoming-match {
    display: flex;
    margin-bottom: 12px;
  }
  .upcoming-match-date {
    text-align: center;
    margin: 0.9em 0 0.4em 90px;
  }
  .upcoming-title {
    font-size: 2em;
    font-weight: 800;
    text-align: center;
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
</style>
