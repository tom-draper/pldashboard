<script>
  import { onMount } from "svelte";

  function toInitials(team) {
    switch (team) {
      case "Brighton and Hove Albion":
        return "BHA";
      case "Manchester City":
        return "MCI";
      case "Manchester United":
        return "MUN";
      case "Aston Villa":
        return "AVL";
      case "Sheffield United":
        return "SHU";
      case "West Bromwich Albion":
        return "WBA";
      case "West Ham United":
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

  function getFormStarTeams(data, team, matchdays) {
    let formStarTeams = [];
    for (let matchday of matchdays) {
      formStarTeams.push(data.form[team][matchday].beatStarTeam ? 'star-team' : '');
    }

    // Fill in blanks
    for (let i = formStarTeams.length; i < 5; i++) {
      formStarTeams.push("");
    }

    return formStarTeams;
  }

  function getFormIcons(data, team) {
    let formIcons = [];
    if (data.form[team].length > 0) {
      formIcons = data.form[team][currentMatchday].form5.split('');
    }

    // Fill in blanks with None icons
    for (let i = formIcons.length; i < 5; i++) {
      formIcons.push('N');
    }

    return formIcons;
  }

  function getFormInitials(data, team, matchdays) {
    let formInitials = [];

    for (let matchday of matchdays) {
      formInitials.push(toInitials(data.form[team][matchday].team))
    }

    // Fill in blanks with None icons
    for (let i = formInitials.length; i < 5; i++) {
      formInitials.push('');
    }

    return formInitials;
  }

  let matchdays;
  let formIcons, formStarTeams, formInitials;
  onMount(() => {
    let sortedMatchdays = getSortedMatchdays(data, fullTeamName);
    matchdays = sortedMatchdays.slice(-5);
    formIcons = getFormIcons(data, fullTeamName);
    formStarTeams = getFormStarTeams(data, fullTeamName, matchdays);
    formInitials = getFormInitials(data, fullTeamName, matchdays);
    console.log(formIcons, formStarTeams, formInitials);
  });
  export let data, currentMatchday, fullTeamName;
</script>

{#if formInitials != undefined}
  <div class="current-form-row">
    <div
      class="icon pos-0 {formIcons[0]} {formStarTeams[0]}"
    />
    <div
      class="icon pos-1 {formIcons[1]} {formStarTeams[1]}"
    />
    <div
      class="icon pos-2 {formIcons[2]} {formStarTeams[2]}"
    />
    <div
      class="icon pos-3 {formIcons[3]} {formStarTeams[3]}"
    />
    <div
      class="icon pos-4 {formIcons[4]} {formStarTeams[4]}"
    />
  </div>
  <div class="current-form-row">
    <div class="icon-name pos-0">
      {formInitials[0]}
    </div>
    <div class="icon-name pos-1">
      {formInitials[1]}
    </div>
    <div class="icon-name pos-2">
      {formInitials[2]}
    </div>
    <div class="icon-name pos-3">
      {formInitials[3]}
    </div>
    <div class="icon-name pos-4">
      {formInitials[4]}
    </div>
  </div>
{/if}
<div class="current-form">
  Current form:
  {#if currentMatchday != null}
    {(data.form[fullTeamName][currentMatchday].formRating5 * 100).toFixed(2)}%
  {:else}
    None
  {/if}
</div>
