<script lang="ts">
  import { Router, Route } from "svelte-routing";
  import Dashboard from "./routes/Dashboard.svelte";
  import Home from "./routes/Home.svelte";
  import Predictions from "./routes/Predictions.svelte";
  import Fantasy from "./routes/Fantasy.svelte";
  import Error from "./routes/Error.svelte";

  // Used for SSR. A falsy value is ignored by the Router.
  export let url = "";
</script>

<Router {url}>
  <Route path="/">
    <Dashboard hyphenatedTeam="{null}" />
  </Route>
  <Route path="/predictions" component={Predictions} />
  <Route path="/:team" let:params>
    <Dashboard hyphenatedTeam={params.team} />
  </Route>
  <Route path="/home" component={Home} />
  <Route path="/fantasy/:page" let:params>
    <Fantasy page={params.page} />
  </Route>
  <Route path="/fantasy" component={Fantasy} />
  <Route path="/error" component={Error} />
</Router>
