// Slim, browser-only Plotly loader.
//
// Plotly (via @plotly/d3) touches browser globals like `self` at module-eval
// time, so it must never be imported during SSR. Instead of a static import we
// expose a stable `Plotly` object that starts empty — safe on the server — and
// is populated in the browser by loadPlotly() the first time a chart mounts.
//
// We also keep the bundle slim: rather than the full ~1.3 MB dist, we start from
// plotly.js/lib/core and register only the trace types the dashboard draws
// (scatter, bar, scatterpolar). The dynamic import makes Plotly its own async
// chunk, kept out of the initial page payload entirely.

// The shared instance every component imports. Because loadPlotly() copies the
// real methods onto *this* object, and the graph lifecycle always awaits
// loadPlotly() before any Plotly.* call, the methods are present by call time.
const Plotly = {} as typeof import('plotly.js');

let loading: Promise<typeof import('plotly.js')> | undefined;

/**
 * Browser-only. Dynamically imports the slim Plotly bundle, registers the trace
 * modules once, and copies the module's methods onto the shared {@link Plotly}
 * object. Idempotent — repeated calls return the same in-flight/settled promise.
 */
export function loadPlotly(): Promise<typeof import('plotly.js')> {
	if (!loading) {
		loading = (async () => {
			const [core, scatter, bar, scatterpolar] = await Promise.all([
				import('plotly.js/lib/core'),
				import('plotly.js/lib/scatter'),
				import('plotly.js/lib/bar'),
				import('plotly.js/lib/scatterpolar')
			]);
			core.default.register([scatter.default, bar.default, scatterpolar.default]);
			Object.assign(Plotly, core.default);
			return Plotly;
		})();
	}
	return loading;
}

export default Plotly;
