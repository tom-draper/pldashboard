<script lang="ts">
	import { Router, Link, Route } from "svelte-routing";
  	import Home from "./routes/Home.svelte";
  	import About from "./routes/About.svelte";
 	import Blog from "./routes/Blog.svelte";

  	export let url = "";
</script>

<Router url="{url}">
  <nav>
    <Link to="/">Home</Link>
    <Link to="about">About</Link>
    <Link to="blog">Blog</Link>
  </nav>
  <div>
    <!-- <Route path="blog/:id" component="{BlogPost}" /> -->
    <Route path="blog" component="{Blog}" />
    <Route path="about" component="{About}" />
    <Route path="/"><Home /></Route>
  </div>
</Router>
<!-- 
<main>
	<h1>Hello {name}!</h1>
	<p>Visit the <a href="https://svelte.dev/tutorial">Svelte tutorial</a> to learn how to build Svelte apps.</p>
</main> -->

<style>
	/* main {
		text-align: center;
		padding: 1em;
		max-width: 240px;
		margin: 0 auto;
	} */

	h1 {
		color: #ff3e00;
		text-transform: uppercase;
		font-size: 4em;
		font-weight: 100;
	}

	/* @media (min-width: 640px) {
		main {
			max-width: none;
		}
	} */
</style> 