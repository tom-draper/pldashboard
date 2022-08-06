<script>
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
    let matchdays = Object.keys(data.form[data._id][team]).sort(
      function (a, b) {
        return (
          new Date(data.form[data._id][team][a].date) -
          new Date(data.form[data._id][team][b].date)
        );
      }
    );
    return matchdays;
  }

  function getFormStarTeams(data, team, matchdays) {
    let formStarTeams = [];
    for (let matchday of matchdays) {
      formStarTeams.unshift(
        data.form[data._id][team][matchday].beatStarTeam
          ? "star-team"
          : ""
      );
    }

    // Fill in blanks
    for (let i = formStarTeams.length; i < 5; i++) {
      formStarTeams.unshift("");
    }

    return formStarTeams;
  }

  function getFormIcons(data, team) {
    let formIcons = [];
    if (Object.keys(data.form[data._id][team][currentMatchday]).length > 0) {
      formIcons = data.form[data._id][team][currentMatchday].form5.split("");
    }

    // Fill in blanks with None icons
    for (let i = formIcons.length; i < 5; i++) {
      formIcons.unshift("N");
    }

    return formIcons;
  }

  function getFormInitials(data, team, matchdays) {
    let formInitials = [];

    for (let matchday of matchdays) {
      formInitials.unshift(
        toInitials(data.form[data._id][team][matchday].team)
      );
    }

    // Fill in blanks with None icons
    for (let i = formInitials.length; i < 5; i++) {
      formInitials.unshift("");
    }

    return formInitials;
  }

  let formIcons, formStarTeams, formInitials;
  function setFormValues() {
    let sortedMatchdays = getSortedMatchdays(data, fullTeamName);
    let matchdays = sortedMatchdays.slice(-5);
    formIcons = getFormIcons(data, fullTeamName);
    formStarTeams = getFormStarTeams(data, fullTeamName, matchdays);
    formInitials = getFormInitials(data, fullTeamName, matchdays);
  }

  $: fullTeamName && setFormValues();

  export let data, currentMatchday, fullTeamName;
</script>

{#if formInitials != undefined}
  <div class="current-form-row">
    <div class="icon pos-0 {formIcons[0]} {formStarTeams[0]}" />
    <div class="icon pos-1 {formIcons[1]} {formStarTeams[1]}" />
    <div class="icon pos-2 {formIcons[2]} {formStarTeams[2]}" />
    <div class="icon pos-3 {formIcons[3]} {formStarTeams[3]}" />
    <div class="icon pos-4 {formIcons[4]} {formStarTeams[4]}" />
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
    {(
      data.form[data._id][fullTeamName][currentMatchday].formRating5 *
      100
    ).toFixed(1)}%
  {:else}
    None
  {/if}
</div>

<!--<style scoped>
  .current-form {
    font-size: 1.8rem;
    margin: 20px 10px;
  }
  .current-form-row {
    font-size: 0.9em;
    display: flex;
    width: min(80%, 600px);
    width: 100%;
  }

  .icon {
    position: relative;
    width: 20%;
    height: 0;
    padding-bottom: 20%;
    margin: 0 5px;
    background-repeat: no-repeat;
    background-size: contain;
  }

  .icon-name {
    position: relative;
    width: 20%;
    margin: 0 5px;
  }

  .pos-4 {
    /* Most recent game */
    opacity: 100%;
  }

  .pos-3 {
    opacity: 90%;
  }

  .pos-2 {
    opacity: 80%;
  }

  .pos-1 {
    opacity: 70%;
  }

  .pos-0 {
    /* Least recent game */
    opacity: 50%;
  }
</style>-->
