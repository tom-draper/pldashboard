<script>
  import { Router, Route } from "svelte-routing";
  import Home from "./routes/Home.svelte";
  import Team from "./routes/Team.svelte";
  import Predictions from "./routes/Predictions.svelte";

  // Used for SSR. A falsy value is ignored by the Router.
  export let url = "";
</script>


<Router url="{url}">
  <Route path="/" component="{Home}" />
  <Route path="/predictions" component="{Predictions}" />
  <Route path="/:team" let:params>
    <Team team={params.team} />
  </Route>
</Router>