<script lang="ts">
  import FormTiles from "./FormTiles.svelte";

  function getSortedMatchdays(data: TeamData, team: string): string[] {
    let matchdays = Object.keys(data.form[data._id][team]).sort(function (
      matchday1,
      matchday2
    ) {
      return (
        (new Date(data.form[data._id][team][matchday1].date) as any) -
        (new Date(data.form[data._id][team][matchday2].date) as any)
      );
    });
    return matchdays;
  }

  function getFormStarTeams(
    data: TeamData,
    team: string,
    matchdays: string[]
  ): boolean[] {
    let formStarTeams = [];
    for (let matchday of matchdays) {
      let oppTeam = data.form[data._id][team][matchday].team;
      formStarTeams.push(data.teamRatings[oppTeam].totalRating > 0.75);
    }

    // Fill in blanks
    for (let i = formStarTeams.length; i < 5; i++) {
      formStarTeams.push(false);
    }

    console.log(formStarTeams)

    return formStarTeams;
  }

  function getFormIcons(data: TeamData, team: string): string {
    let formIcons: string[] = [];
    if (Object.keys(data.form[data._id][team][currentMatchday]).length > 0) {
      formIcons = data.form[data._id][team][currentMatchday].form5.split("").reverse();
    }

    // Fill in blanks with None icons
    for (let i = formIcons.length; i < 5; i++) {
      formIcons.unshift("N");
    }
    return formIcons.join('');
  }

  function getFormInitials(
    data: TeamData,
    team: string,
    matchdays: string[]
  ): string[] {
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

  function latestNPlayedMatchdays(
    data: TeamData,
    team: string,
    matchdays: string[],
    N: number
  ): string[] {
    let latestN = [];

    for (let i = matchdays.length - 1; i >= 0; i--) {
      if (data.form[data._id][team][matchdays[i]].score != null) {
        latestN.push(matchdays[i]);
      }
      if (latestN.length >= N) {
        break;
      }
    }

    return latestN;
  }

  function setFormValues() {
    let sortedMatchdays = getSortedMatchdays(data, team);

    let matchdays = latestNPlayedMatchdays(data, team, sortedMatchdays, 5);
    
    formIcons = getFormIcons(data, team);
    formStarTeams = getFormStarTeams(data, team, matchdays);
    formInitials = getFormInitials(data, team, matchdays);
  }
  
  let formIcons: string, formStarTeams: boolean[], formInitials: string[];
  $: team && setFormValues();
  
  export let data: TeamData,
    currentMatchday: string,
    team: string,
    toInitials: Function;
</script>

{#if formInitials != undefined}
  <div class="current-form-row icon-row">
    <FormTiles form={formIcons}, starTeams={formStarTeams} />
  </div>
  <div class="current-form-row name-row">
    <div class="icon-name pos-0">{formInitials[0]}</div>
    <div class="icon-name pos-1">{formInitials[1]}</div>
    <div class="icon-name pos-2">{formInitials[2]}</div>
    <div class="icon-name pos-3">{formInitials[3]}</div>
    <div class="icon-name pos-4">{formInitials[4]}</div>
  </div>
{/if}
<div class="current-form">
  Current form:
  {#if currentMatchday != null}
    <span class="current-form-value">{(data.form[data._id][team][currentMatchday].formRating5 * 100).toFixed(1)}%</span>
  {:else}
    None
  {/if}
</div>

<style scoped>
  .current-form {
    font-size: 1.7rem;
    margin: 20px 0;
    padding: 10px 25px 8px;
    background: #38003d;
    color: white;
    border-radius: var(--border-radius);
  }
  .current-form-row {
    font-size: 13px;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    width: 100%;
  }
  .current-form-value {
    color: #00fe87;
  }

  /* .name-row {
    margin: 0 12px 0 4px;
  } */

  .icon-name {
    position: relative;
    margin-top: 0.6em;
  }

  @media only screen and (max-width: 1100px) {
    .current-form-row {
      width: min(80%, 440px);
      /* margin-right: 8px; */
    }
    /* .name-row {
      margin: 0 0 8px
    } */
  }
  
  @media only screen and (max-width: 700px) {
    .current-form-row {
      width: 95%;
    }
  }
</style>
