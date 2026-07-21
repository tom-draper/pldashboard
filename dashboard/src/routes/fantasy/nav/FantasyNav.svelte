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

<nav id="navBar" class="fixed h-screen w-[220px] bg-[var(--purple)] max-[1200px]:hidden">
	<div class="grid h-24 select-none place-items-center text-[1.6em] text-white">
		<a href="/home" class="text-white">
			<span class="text-[var(--green)]">pl</span>dashboard
			<div class="absolute top-[59px] right-[40px] text-[0.67em] text-white">Fantasy</div>
		</a>
	</div>
	<div class="grid text-[1em] text-[var(--pink)]">
		{#each pages as _page, _ (_page)}
			{#if _page === currentPage}
				<a href="/fantasy{_page === 'all' ? '' : '/' + _page}">
					<div class="bg-[var(--green)] text-[var(--purple)]">
						<div class="px-[1.4em] py-[0.4em]">
							{_page[0].toUpperCase() + _page.slice(1)}
						</div>
					</div>
				</a>
			{:else}
				<button
					class="cursor-pointer border-none bg-transparent p-0 text-left text-inherit outline-none [font:inherit]"
					on:click={() => {
						switchPage(_page);
					}}
				>
					<div class="hover:bg-[#140921]">
						<div class="px-[1.4em] py-[0.4em]">
							{_page[0].toUpperCase() + _page.slice(1)}
						</div>
					</div>
				</button>
			{/if}
		{/each}
	</div>
	<div
		class="group absolute bottom-[3.75em] mx-[1.4em] mt-[0.4em] cursor-pointer text-[13px] text-white"
	>
		<a
			class="text-inherit no-underline group-hover:text-[var(--green)]"
			href="https://www.buymeacoffee.com/tomdraper">Buy Me a Coffee</a
		>
	</div>
	<div
		class="group absolute bottom-[1em] mx-[1.4em] mb-[3px] mt-[0.4em] cursor-pointer text-[13px] text-white"
	>
		<a class="text-inherit no-underline group-hover:text-[var(--green)]" href="/">Dashboard</a>
	</div>
	<div>
		<button
			class="absolute right-[0.9em] bottom-[0.9em] mb-px cursor-pointer border-none bg-transparent pt-[0.3em] outline-none"
			on:click={closeNavBar}
		>
			<img src={closeNavIcon} alt="" class="h-[25px] w-[25px]" />
		</button>
	</div>
</nav>
