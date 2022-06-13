<script>
  import { Router, Route } from "svelte-routing";
  import Home from "./routes/Home.svelte";
  // import About from "./routes/About.svelte";
  // import Blog from "./routes/Blog.svelte";
  import Team from "./routes/Team.svelte";
  import Predictions from "./routes/Predictions.svelte";

  // Used for SSR. A falsy value is ignored by the Router.
  export let url = "";
</script>


<Router url="{url}">
  <!-- <script type="text/javascript" src="https://storage.ko-fi.com/cdn/widget/Widget_2.js"></script> -->
  <!-- <nav>
    <NavLink to="/">Home</NavLink>
    <NavLink to="about">About</NavLink>
    <NavLink to="blog">Blog</NavLink>
  </nav> -->
  <!-- <Route path="about" component="{About}" /> -->
  <!-- <Route path="blog/*" component="{Blog}" /> -->
  <Route path="/" component="{Home}" />
  <Route path="/predictions" component="{Predictions}" />
  <Route path="/:team" let:params>
    <Team team={params.team} />
  </Route>
</Router>