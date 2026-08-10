// Slim custom Plotly bundle. Instead of loading the full ~1.3 MB dist from the
// CDN, we start from plotly.js/lib/core (no trace types) and register only the
// trace modules the dashboard actually draws: scatter, bar and scatterpolar.
// This keeps the bundle to a fraction of the full build.
//
// The submodule entries resolve to loosely-typed JS, so the assembled default
// export is cast back to the full `plotly.js` module type — every method we call
// (newPlot, purge, redraw, relayout, update) lives on core.
import Plotly from 'plotly.js/lib/core';
import scatter from 'plotly.js/lib/scatter';
import bar from 'plotly.js/lib/bar';
import scatterpolar from 'plotly.js/lib/scatterpolar';

Plotly.register([scatter, bar, scatterpolar]);

export default Plotly as typeof import('plotly.js');
