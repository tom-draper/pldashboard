<script lang="ts">
	import type { Page } from '../fantasy.types';
	import closeNavIcon from '$lib/images/arrow-bar-left.svg';

	function closeNavBar() {
		const navBar = document.getElementById('navBar');
		if (navBar !== null) {
			navBar.style.display = 'none';
		}
		const dashboard = document.getElementById('dashboard');
		if (dashboard !== null) {
			dashboard.style.marginLeft = '0';
			dashboard.style.width = '100%';
		}
		window.dispatchEvent(new Event('resize')); // Snap plotly graphs to new width
	}

	export let currentPage: string, pages: Page[], switchPage: (page: Page) => void;
</script>

<nav id="navBar">
	<div class="title no-selection">
		<a href="/home">
			<span style="color: var(--green)">pl</span>dashboard
			<div class="fantasy-logo">Fantasy</div>
		</a>
	</div>
	<div class="team-links">
		{#each pages as _page, _ (_page)}
			{#if _page === currentPage}
				<a href="/fantasy{_page === 'all' ? '' : '/' + _page}" class="team-link">
					<div class="this-team-container">
						<div class="this-team-name">
							{_page[0].toUpperCase() + _page.slice(1)}
						</div>
					</div>
				</a>
			{:else}
				<button
					class="team-link"
					on:click={() => {
						switchPage(_page);
					}}
				>
					<div class="team-container">
						<div class="team-name">
							{_page[0].toUpperCase() + _page.slice(1)}
						</div>
					</div>
				</button>
			{/if}
		{/each}
	</div>
	<div class="donate"><a href="https://www.buymeacoffee.com/tomdraper">Buy Me a Coffee</a></div>
	<div class="fantasy"><a href="/">Dashboard</a></div>
	<div class="close">
		<button class="close-btn" on:click={closeNavBar}>
			<img src={closeNavIcon} alt="" />
		</button>
	</div>
</nav>

<style scoped>
	.title {
		color: white;
		font-size: 1.6em;
		height: 96px;
		display: grid;
		place-items: center;
	}
	.title a {
		color: white;
	}
	.fantasy-logo {
		color: white;
		position: absolute;
		font-size: 0.67em;
		top: 59px;
		right: 40px;
	}
	.no-selection {
		user-select: none;
		-webkit-user-select: none;
		-moz-user-select: none;
	}
	.team-links {
		font-size: 1em;
		color: var(--pink);
		display: grid;
	}
	button {
		background: none;
		color: inherit;
		border: none;
		padding: 0;
		font: inherit;
		cursor: pointer;
		outline: inherit;
		text-align: left;
	}
	.team-name,
	.this-team-name {
		padding: 0.4em 1.4em;
	}

	.this-team-container {
		color: var(--purple);
		background: var(--green);
	}

	:hover.team-container {
		background: #2c002f;
		background: #140921;
	}
	.donate {
		color: rgba(255, 255, 255, 1);
		position: absolute;
		bottom: 3.75em;
		font-size: 13px;
		margin: 0.4em 1.4em 0;
		cursor: pointer;
	}
	.fantasy {
		color: rgba(255, 255, 255, 1);
		position: absolute;
		bottom: 1em;
		font-size: 13px;
		margin: 0.4em 1.4em 3px;
		cursor: pointer;
	}
	.donate a,
	.fantasy a {
		color: inherit;
		text-decoration: none;
	}
	.donate:hover,
	.fantasy:hover {
		color: rgba(255, 255, 255, 0.7);
		color: var(--green);
	}
	nav {
		position: fixed;
		width: 220px;
		height: 100vh;
		background: #37003c;
		background: var(--purple);
	}
	img {
		height: 25px;
		width: 25px;
	}
	.close-btn {
		position: absolute;
		right: 0.9em;
		bottom: 0.9em;
		background: transparent;
		border: none;
		outline: none;
		padding-top: 0.3em;
		cursor: pointer;
		margin-bottom: 1px;
	}

	@keyframes load {
		from {
			left: -100px;
		}
		to {
			left: 100px;
		}
	}

	@media only screen and (max-width: 1200px) {
		#navBar {
			display: none;
		}
	}
</style>
