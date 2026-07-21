<script lang="ts">
	import type { Page } from '../fantasy.types';

	function switchTeamToTop(page: Page) {
		switchPage(page);
		window.scrollTo(0, 0);
		toggleMobileNav();
	}

	export let pages: Page[], switchPage: (page: Page) => void, toggleMobileNav: () => void;
</script>

<nav
	id="mobileNav"
	class="fixed z-[2] hidden h-screen overflow-hidden animate-[appear_0.1s_ease-in]"
	style="width: 0%;"
>
	{#if pages != undefined}
		<div class="flex h-full flex-col">
			{#each pages as page, i}
				<button
					on:click={() => {
						switchTeamToTop(page);
					}}
					class="team-link flex-1 cursor-pointer border-none p-[0.4em] text-[1em] {page.toLowerCase()}"
					>{pages[i][0].toUpperCase() + pages[i].slice(1)}</button
				>
			{/each}
		</div>
	{/if}
</nav>

<style scoped>
	/* Position-specific colours are selected at runtime via the page name as a
	   class, so they stay as CSS. The base .team-link colour applies to pages
	   without a specific override (all, midfielder). */
	.team-link {
		color: #1c0d2d;
		background: #00fe87;
	}
	.forward {
		background: var(--pink);
	}
	.defender {
		background: #2dbaff;
	}
	.goalkeeper {
		background: #280936;
		color: white;
	}
	@keyframes appear {
		from {
			width: 0%;
		}
		to {
			width: 100%;
		}
	}
</style>
