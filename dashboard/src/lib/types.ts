import type * as PlotlyJS from 'plotly.js';

export enum Team {
	Arsenal = 'Arsenal',
	AstonVilla = 'Aston Villa',
	Bournemouth = 'Bournemouth',
	Brentford = 'Brentford',
	BrightonAndHoveAlbion = 'Brighton and Hove Albion',
	Burnley = 'Burnley',
	Chelsea = 'Chelsea',
	CrystalPalace = 'Crystal Palace',
	Everton = 'Everton',
	Fulham = 'Fulham',
	LeedsUnited = 'Leeds United',
	LeicesterCity = 'Leicester City',
	Liverpool = 'Liverpool',
	LutonTown = 'Luton Town',
	ManchesterCity = 'Manchester City',
	ManchesterUnited = 'Manchester United',
	NewcastleUnited = 'Newcastle United',
	NorwichCity = 'Norwich City',
	NottinghamForest = 'Nottingham Forest',
	SheffieldUnited = 'Sheffield United',
	Southampton = 'Southampton',
	TottenhamHotspur = 'Tottenham Hotspur',
	Watford = 'Watford',
	WestBromwichAlbion = 'West Bromwich Albion',
	WestHamUnited = 'West Ham United',
	WolverhamptonWanderers = 'Wolverhampton Wanderers'
}

/**
 * A complete Plotly plot definition as used across the chart components.
 *
 * Note this shadows Plotly's own global `PlotData` (a single trace). Always
 * import this explicitly so the intended type wins.
 */
/**
 * A single Plotly trace.
 *
 * Plotly's own `Data` is a union across every trace type, so members such as
 * `marker` and `y` are not accessible on it. These charts only build
 * scatter/bar traces, so the single-trace shape is both accurate and usable.
 * Annotating trace helpers with this also stops literals like `type: 'bar'`
 * widening to `string`.
 */
export type PlotTrace = Partial<PlotlyJS.PlotData>;
export type PlotLayout = Partial<PlotlyJS.Layout>;
export type PlotShape = Partial<PlotlyJS.Shape>;
export type PlotConfig = Partial<PlotlyJS.Config>;

export type PlotData = {
	data: PlotTrace[];
	layout: PlotLayout;
	config: PlotConfig;
};

export type Counter = {
	[k: string | number | symbol]: number;
};

export type Score = {
	homeGoals: number;
	awayGoals: number;
};

export type Scoreline = Score & {
	homeTeam: Team;
	awayTeam: Team;
};
