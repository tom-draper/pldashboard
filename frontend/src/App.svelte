<script lang="ts">
  import { Router, Route } from "svelte-routing";
  import Teams from "./routes/Teams.svelte";
  import Team from "./routes/Team.svelte";
  import Home from "./routes/Home.svelte";
  import Predictions from "./routes/Predictions.svelte";

  // Used for SSR. A falsy value is ignored by the Router.
  export let url = "";
</script>

<Router {url}>
  <Route path="/">
    <Team hyphenatedTeam={null} />
  </Route>
  <Route path="/predictions" component={Predictions} />
  <Route path="/:team" let:params>
    <Team hyphenatedTeam={params.team} />
  </Route>
  <Route path="/teams" component={Teams} />
  <Route path="/home" component={Home} />
</Router>
