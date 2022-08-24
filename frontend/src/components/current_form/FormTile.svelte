<script>
  function background(result, starTeam) {
    if (starTeam) {
      return "linear-gradient(red, blue, green)";
    }

    switch (result) {
      case "W":
        return "#77dd77";
      case "D":
        return "#ffb347";
      case "L":
        return "#c23b22";
      default:
        return "transparent";
    }
  }

  function formatResult(result) {
    switch (result) {
      case "W":
      case "D":
      case "L":
        return result;
      default:
        return "";
    }
  }

  function opacity(recency) {
    switch (recency) {
      case 0:
        return 1;
      case 1:
        return 0.8;
      case 2:
        return 0.6;
      case 3:
        return 0.4;
      case 4:
        return 0.2;
    }
  }

  export let result, recency, starTeam;
</script>

<div
  id="formTile"
  style="background: {background(result, starTeam)}; opacity: {opacity(
    recency
  )}"
>
  <div class="result">
    {formatResult(result)}
  </div>
</div>

<style>
  #formTile {
    width: 100%;
    height: 100%;
    aspect-ratio: 1/1;
    border-radius: 6px;
    color: #2b2d2f;
    display: grid;
    place-items: center;
    border: 3px #333333 solid;
  }
  .result {
    margin-top: 0.14em;
    font-size: 2vw;
  }
  
  @media only screen and (max-width: 1100px) {
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
