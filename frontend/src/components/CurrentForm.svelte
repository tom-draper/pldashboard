<script>
  import { onMount } from "svelte";

  function toInitials(team) {
    switch (team) {
      case "Brighton and Hove Albion FC":
        return "BHA";
      case "Manchester City FC":
        return "MCI";
      case "Manchester United FC":
        return "MUN";
      case "Aston Villa FC":
        return "AVL";
      case "Sheffield United FC":
        return "SHU";
      case "West Bromwich Albion FC":
        return "WBA";
      case "West Ham United FC":
        return "WHU";
    }
    return team.slice(0, 3).toUpperCase();
  }

  function getSortedMatchdays(data, team) {
    let matchdays = Object.keys(data.form[team]).sort(function (a, b) {
      return (
        new Date(data.form[team][a].date) - new Date(data.form[team][b].date)
      );
    });
    return matchdays;
  }

  let matchdays;
  onMount(() => {
    let sortedMatchdays = getSortedMatchdays(data, fullTeamName);
    matchdays = sortedMatchdays.slice(-5);
  });
  export let data, currentMatchday, fullTeamName;
</script>

{#if matchdays != undefined}
  <div class="current-form-row">
    <div
      class="icon pos-0 {data.form[fullTeamName][currentMatchday].form5.charAt(
        0
      )} {data.form[fullTeamName][matchdays[0]].beatStarTeam
        ? 'star-team'
        : ''}"
    />
    <div
      class="icon pos-1 {data.form[fullTeamName][currentMatchday].form5.charAt(
        1
      )} {data.form[fullTeamName][matchdays[1]].beatStarTeam
        ? 'star-team'
        : ''}"
    />
    <div
      class="icon pos-2 {data.form[fullTeamName][currentMatchday].form5.charAt(
        2
      )} {data.form[fullTeamName][matchdays[2]].beatStarTeam
        ? 'star-team'
        : ''}"
    />
    <div
      class="icon pos-3 {data.form[fullTeamName][currentMatchday].form5.charAt(
        3
      )} {data.form[fullTeamName][matchdays[3]].beatStarTeam
        ? 'star-team'
        : ''}"
    />
    <div
      class="icon pos-4 {data.form[fullTeamName][currentMatchday].form5.charAt(
        4
      )} {data.form[fullTeamName][matchdays[4]].beatStarTeam
        ? 'star-team'
        : ''}"
    />
  </div>
  <div class="current-form-row">
    <div class="icon-name pos-0">
      {toInitials(data.form[fullTeamName][matchdays[0]].team)}
    </div>
    <div class="icon-name pos-1">
      {toInitials(data.form[fullTeamName][matchdays[1]].team)}
    </div>
    <div class="icon-name pos-2">
      {toInitials(data.form[fullTeamName][matchdays[2]].team)}
    </div>
    <div class="icon-name pos-3">
      {toInitials(data.form[fullTeamName][matchdays[3]].team)}
    </div>
    <div class="icon-name pos-4">
      {toInitials(data.form[fullTeamName][matchdays[4]].team)}
    </div>
  </div>
{/if}
<div class="current-form">
  Current form: {(
    data.form[fullTeamName][currentMatchday].formRating5 * 100
  ).toFixed(2)}%
</div>
