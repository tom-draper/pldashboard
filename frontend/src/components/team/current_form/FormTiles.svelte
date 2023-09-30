<script lang="ts">
  function background(result: string, starTeam: boolean): string {
    switch (result) {
      case 'W':
        if (starTeam) {
          return 'linear-gradient(30deg, var(--green), #2bd2ff, #fa8bff)';
        } else {
          return '#00fe87';
        }
      case 'D':
        return '#ffdd00';
      case 'L':
        return '#f83027';
      default:
        return '#d6d6d6';
    }
  }

  function formatResult(result: string): string {
    switch (result) {
      case 'W':
      case 'D':
      case 'L':
        return result;
      default:
        return '';
    }
  }

  export let form: string, starTeams: boolean[];
</script>

<div class="icon pos-0">
  <div id="formTile" style="background: {background(form[0], starTeams[0])}">
    <div class="result">
      {formatResult(form[0])}
    </div>
  </div>
</div>
<div class="icon pos-1">
  <div id="formTile" style="background: {background(form[1], starTeams[1])}">
    <div class="result">
      {formatResult(form[1])}
    </div>
  </div>
</div>
<div class="icon pos-2">
  <div id="formTile" style="background: {background(form[2], starTeams[2])}">
    <div class="result">
      {formatResult(form[2])}
    </div>
  </div>
</div>
<div class="icon pos-3">
  <div id="formTile" style="background: {background(form[3], starTeams[3])}">
    <div class="result">
      {formatResult(form[3])}
    </div>
  </div>
</div>
<div class="icon pos-4">
  <div id="formTile" style="background: {background(form[4], starTeams[4])}">
    <div class="result">
      {formatResult(form[4])}
    </div>
  </div>
</div>

<style>
  #formTile {
    width: 100%;
    aspect-ratio: 1/0.9;
    color: #2b2d2f;
    display: grid;
    place-items: center;
    border-radius: inherit;
  }
  .result {
    margin-top: 0.14em;
    font-size: 2vw;
  }

  .icon {
    position: relative;
    flex: 1;
  }

  .pos-3,
  .pos-4,
  .pos-2,
  .pos-1 {
    border-left: none;
  }

  .pos-4 {
    /* Most recent game */
    opacity: 100%;
    border-radius: 0 6px 6px 0;
  }

  .pos-3 {
    opacity: 89%;
  }

  .pos-2 {
    opacity: 78%;
  }

  .pos-1 {
    opacity: 67%;
  }

  .pos-0 {
    /* Least recent game */
    opacity: 56%;
    border-radius: 6px 0 0 6px;
  }

  @media only screen and (max-width: 1000px) {
    .result {
      font-size: 3em;
    }
  }
  @media only screen and (max-width: 600px) {
    .result {
      font-size: 7vw;
      margin-top: 0.25em;
    }
  }
</style>
