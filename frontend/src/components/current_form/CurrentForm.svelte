<script lang="ts">
  import FormTile from "./FormTile.svelte";

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
      formStarTeams.unshift(data.form[data._id][team][matchday].beatStarTeam);
    }

    // Fill in blanks
    for (let i = formStarTeams.length; i < 5; i++) {
      formStarTeams.unshift("");
    }

    return formStarTeams;
  }

  function getFormIcons(data: TeamData, team: string): string[] {
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
        latestN.unshift(matchdays[i]);
      }
      if (latestN.length >= N) {
        break;
      }
    }

    return latestN;
  }

  let formIcons: string[], formStarTeams: boolean[], formInitials: string[];
  function setFormValues() {
    let sortedMatchdays = getSortedMatchdays(data, team);

    let matchdays = latestNPlayedMatchdays(data, team, sortedMatchdays, 5);

    formIcons = getFormIcons(data, team);
    formStarTeams = getFormStarTeams(data, team, matchdays);
    formInitials = getFormInitials(data, team, matchdays);
  }

  $: team && setFormValues();

  export let data: TeamData,
    currentMatchday: string,
    team: string,
    toInitials: Function;
</script>

{#if formInitials != undefined}
  <div class="current-form-row">
    <div class="icon pos-0">
      <FormTile result={formIcons[0]} starTeam={formStarTeams[0]} />
    </div>
    <div class="icon pos-1">
      <FormTile result={formIcons[1]} starTeam={formStarTeams[1]} />
    </div>
    <div class="icon pos-2">
      <FormTile result={formIcons[2]} starTeam={formStarTeams[2]} />
    </div>
    <div class="icon pos-3">
      <FormTile result={formIcons[3]} starTeam={formStarTeams[3]} />
    </div>
    <div class="icon pos4">
      <FormTile result={formIcons[4]} starTeam={formStarTeams[4]} />
    </div>
  </div>
  <div class="current-form-row">
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
    {(data.form[data._id][team][currentMatchday].formRating5 * 100).toFixed(1)}%
  {:else}
    None
  {/if}
</div>

<style scoped>
  .current-form {
    font-size: 1.8rem;
    margin: 20px 10px;
  }
  .current-form-row {
    font-size: 0.9em;
    display: flex;
    width: min(100%, 500px);
  }

  .icon {
    position: relative;
    width: calc(20% - 14px);
    aspect-ratio: 1/1;
    margin: 0 7px 7px;
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
    opacity: 60%;
  }

  @media only screen and (max-width: 700px) {
    .current-form-row {
      width: 90%;
    }
  }
  @media only screen and (max-width: 1100px) {
    .icon {
      width: 20vw;
    }

    .current-form-row {
      width: min(80%, 600px);
    }
  }
</style>
