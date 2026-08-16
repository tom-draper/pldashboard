import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// plotly.js is a CommonJS bundle that references Node's `global`, which does
	// not exist in the browser. Map it to the universal `globalThis` so the lazy
	// Plotly chunk runs client-side. globalThis exists under Node too, so this is
	// safe for the SSR build as well.
	define: {
		global: 'globalThis'
	}
});
