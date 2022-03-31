from collections import defaultdict
import os
from datetime import datetime
from typing import Optional

import numpy as np
import plotly
import plotly.graph_objects as go
from pandas.core.frame import DataFrame
from plotly.missing_ipywidgets import FigureWidget
from timebudget import timebudget

from data import Fixtures, Form, HomeAdvantages, TeamRatings
from utilities import Utilities

utils = Utilities()


class Graph:
    
    @staticmethod
    def save_fig(
            fig: FigureWidget, 
            team: str, 
            graph_type: str,
            path: str = './templates/graphs/', 
            auto_open: bool = False,
            display_mode_bar: bool = False, 
            scroll_zoom: bool = False,
        ):
        file_team_name = '-'.join(team.lower().split()
                                  [:-1]).replace('&', 'and')

        temp_path = f'{path}{file_team_name}/temp-{graph_type}-{file_team_name}.html'
        path = f'{path}{file_team_name}/{graph_type}-{file_team_name}.html'

        # Save plot as HTML file
        plotly.offline.plot(
            fig,
            filename=temp_path,
            auto_open=auto_open,
            include_plotlyjs=False,
            # output_type='div',
            config={'displayModeBar': display_mode_bar, 'scrollZoom': scroll_zoom})

        try:
            os.rename(temp_path, path)
        except WindowsError:
            os.remove(path)
            os.rename(temp_path, path)
    
    @staticmethod
    def _teams_to_update(team: str, all_teams: list[str], graph_name: str) -> str:
        if team is None:
            print(f'📊 Updating all team\'s \'{graph_name}\' graphs...')
            teams_to_update = all_teams
        else:
            print(f'📊 Updating {team} \'{graph_name}\' graph...')
            teams_to_update = [team]
        return teams_to_update


class Fixtures(Graph):
    
    @staticmethod    
    def _plot_points(
            x: list[datetime], 
            y: list[float],
            sizes: list[int], 
            details: list[str],
        ) -> FigureWidget:
        FIXTURES_COLOUR_SCALE = ['#01c626', '#08a825',  '#0b7c20', '#0a661b',
                                 '#064411', '#000000', '#5b1d15', '#85160f',
                                 '#ad1a10', '#db1a0d', '#fc1303']
        fig = go.Figure(data=go.Scatter(x=x,
                                        y=y,
                                        mode='lines+markers',
                                        marker=dict(size=sizes,
                                                    color=y,
                                                    colorscale=FIXTURES_COLOUR_SCALE),
                                        line=dict(color='#737373'),
                                        text=details,
                                        hovertemplate='<b>%{text}</b><br>%{x|%d %b %Y}<br>Team rating: <b> %{y:.1f}%</b><extra></extra>',
                                        hoverinfo=('x+y+text')))
        return fig

    @staticmethod
    def _plot_current_day(fig: FigureWidget, NOW: datetime):
        fig.add_shape(go.layout.Shape(type='line',
                                      yref='paper',
                                      xref='x',
                                      x0=NOW,
                                      y0=0.01,
                                      x1=NOW,
                                      y1=0.99,
                                      line=dict(color='black',
                                                width=1,
                                                dash='dot')))

    @staticmethod
    def _format_fig(fig: FigureWidget, x: list[datetime]):
        y_labels = [i for i in range(0, 101, 10)]

        fig.update_layout(
            autosize=True,
            yaxis=dict(
                title_text='Team Rating (%)',
                range=[-6, 106],  # Create gap 6 point gap either side for 0% or 100% rated team marker
                ticktext=y_labels,
                tickvals=y_labels,
                gridcolor='gray',
                showline=False,
                zeroline=False,
                fixedrange=True
            ),
            xaxis=dict(
                title_text='Matchday',
                linecolor='black',
                showgrid=False,
                showline=False,
                ticktext=[i for i in range(2, len(x)+2, 2)],
                tickvals=[x[i] for i in range(1, len(x)+1, 2)],
                fixedrange=True
            ),
            margin=dict(
                l=50,
                r=50,
                b=10,
                t=10,
                pad=4
            ),
            plot_bgcolor='#fafafa',
            paper_bgcolor='#fafafa',
        )

    def _get_fig(
            self, 
            x: list[datetime], 
            y: list[float], 
            details: list[str],
            sizes: list[int], 
            NOW: datetime,
        ) -> FigureWidget:
        fig = self._plot_points(x, y, sizes, details)
        self._plot_current_day(fig, NOW)
        self._format_fig(fig, x)
        return fig

    @staticmethod
    def _rating(
            match: dict, 
            team_ratings: TeamRatings, 
            home_advantages: HomeAdvantages,
        ):
        # Get rating of the opposition team
        rating = team_ratings.df.loc[match['Team'], 'TotalRating']
        # Decrease other team's rating if you're playing at home
        if match['AtHome']:
            rating *= (1 -
                       home_advantages.df.loc[match['Team'], 'TotalHomeAdvantage'][0])
        return rating

    @staticmethod
    def _match_detail(match: dict) -> str:
        # Add team played, home or away and the final score if game has already happened
        home_away = 'Home' if match['AtHome'] else 'Away'
        if match['Score'] is not None:
            match_detail = f"{match['Team']} ({home_away})  {match['Score']}"
        else:
            match_detail = f"{match['Team']} ({home_away})"
        return match_detail

    @staticmethod
    def _increase_next_game_size(
            sizes: list[int], 
            x: list[datetime], 
            match_n: int, 
            NOW: datetime, 
            N_MATCHES: int, 
            BIG_MARKER_SIZE: int,
        ):
        if match_n == 0:
            # If haven't played first game of season
            if NOW < x[-1]:
                sizes[match_n] = BIG_MARKER_SIZE
        elif (match_n != N_MATCHES) and (x[-2] < NOW <= x[-1]):
            sizes[match_n] = BIG_MARKER_SIZE

    def _data_points(
            self, 
            team_fixtures: DataFrame, 
            team_ratings: TeamRatings,
            home_advantages: HomeAdvantages, 
            NOW: datetime, 
            N_MATCHES: int,
            DEFAULT_MARKER_SIZE: int, 
            BIG_MARKER_SIZE: int,
        )-> tuple[list[datetime], list[float], list[str], list[int]]:
        x = []
        y = []
        details = []
        # Sizes of each data point marker
        sizes = [DEFAULT_MARKER_SIZE] * N_MATCHES
        
        for match_n in range(N_MATCHES):
            match = team_fixtures[match_n+1]

            # Append single datetime value of matchday to x-axis
            x.append(match['Date'].to_pydatetime())

            # Append percentage rating value of opposition team playing on this matchday
            rating = self._rating(match, team_ratings, home_advantages)
            y.append(rating*100)

            match_detail = self._match_detail(match)
            details.append(match_detail)

            # Increase size of point marker if it's the current upcoming match
            self._increase_next_game_size(sizes, x, match_n, NOW, N_MATCHES, BIG_MARKER_SIZE)

        # Sort the data by date to remove errors due to match rescheduling
        x, y, details = zip(*sorted(zip(x, y, details)))

        return x, y, details, sizes
    

    @timebudget
    def update(
            self, 
            fixtures: Fixtures, 
            team_ratings: TeamRatings,
            home_advantages: HomeAdvantages, 
            team: str = None,
            display: bool = False,
        ):

        teams_to_update = self._teams_to_update(
            team, fixtures.df.index.values.tolist(), 'fixtures')

        DEFAULT_MARKER_SIZE = 14
        BIG_MARKER_SIZE = 26  # Used to highlight next game
        NOW = datetime.now()
        N_MATCHES = 38

        for team_name in teams_to_update:
            # Get row of fixtures dataframe
            team_fixtures = fixtures.df.loc[team_name]
            x, y, details, sizes = self._data_points(team_fixtures,
                                                              team_ratings,
                                                              home_advantages,
                                                              NOW,
                                                              N_MATCHES,
                                                              DEFAULT_MARKER_SIZE,
                                                              BIG_MARKER_SIZE)

            fig = self._get_fig(x, y, details, sizes, NOW)

            if display:
                fig.show()

            self.save_fig(fig, team_name, 'fixtures')


class FormOverTime(Graph):
    
    @staticmethod
    def _plot_teams_form(
            fig: FigureWidget, 
            x: list[datetime],
            ys: list[list[float]], 
            team: str, 
            team_names: list[str],
        ):
        for idx, y in enumerate(ys):
            if team_names[idx] != team:
                fig.add_trace(go.Scatter(x=x,
                                         y=y,
                                         name=team_names[idx],
                                         mode='lines',
                                         line=dict(color='#d3d3d3'),
                                         showlegend=False,
                                         hovertemplate=f'<b>{team_names[idx]}</b><br>' +
                                         'Matchday %{x}<br>Form: <b>%{y:.1f}%</b><extra></extra>',
                                         hoverinfo=('x+y'),
                                         ))
            else:
                team_idx = idx  # Save index the input teams is found for plotting the final line

        # Add this as teams name last to have this line on top
        fig.add_trace(go.Scatter(x=x,
                                 y=ys[team_idx],
                                 name=team_names[team_idx],
                                 mode='lines',
                                 line=dict(color=utils.team_colours[team_names[team_idx]],
                                           width=4),
                                 showlegend=False,
                                 hovertemplate=f'<b>{team_names[team_idx]}</b><br>' +
                                 'Matchday %{x}<br>Form: <b>%{y:.1f}%</b><extra></extra>',
                                 hoverinfo=('x+y'),
                                 ))

    @staticmethod
    def _format_fig(
            fig: FigureWidget, 
            x: list[datetime],
            matchday_labels: list[str],
        ):
        y_labels = [i for i in range(0, 101, 10)]

        fig.update_layout(
            autosize=True,
            yaxis=dict(
                title_text='Form Rating (%)',
                ticktext=y_labels,
                tickvals=y_labels,
                showgrid=False,
                showline=False,
                zeroline=False,
                fixedrange=True
            ),
            xaxis=dict(
                title_text='Matchday',
                linecolor='black',
                tickmode='array',
                dtick=1,
                ticktext=matchday_labels,
                tickvals=x,
                showgrid=False,
                showline=False,
                fixedrange=True
            ),
            margin=dict(
                l=50,
                r=50,
                b=10,
                t=10,
                pad=4
            ),
            plot_bgcolor='#fafafa',
            paper_bgcolor='#fafafa',
        )

    def _get_fig(
            self, 
            x: list[datetime], 
            ys: list[list[float]],
            matchday_labels: list[str], 
            team: str, 
            team_names: list[str],
        ) -> FigureWidget:
        fig = go.Figure()
        self._plot_teams_form(fig, x, ys, team, team_names)
        self._format_fig(fig, x, matchday_labels)
        return fig

    @staticmethod
    def _x_data_points(form: Form) -> list[datetime]:
        x_cols = form.df.iloc[:, form.df.columns.get_level_values(1) == 'Date']

        x = []
        for _, col_data in x_cols.iteritems():
            # Take the median date for that matchday
            median_date = np.median(col_data.values.tolist())
            # Convert from numpy date to datetime format
            x.append(datetime.utcfromtimestamp(median_date/1e9))
        return x

    @staticmethod
    def _y_data_points(form: Form) -> list[list[float]]:
        y_cols = form.df.iloc[:, form.df.columns.get_level_values(
            1) == 'FormRating5']

        ys = []
        for _, row_data in y_cols.iterrows():
            y = row_data.values.tolist()
            y = list(map(lambda x: x * 100, y))  # Convert to percentages
            ys.append(y)
        return ys

    def _data_points(
            self, 
            form: Form,
        ) -> tuple[list[datetime], list[str], list[list[float]]]:
        # All ys have the same x date values
        x = self._x_data_points(form)
        ys = self._y_data_points(form)

        # Sort the x-axis data by date to remove errors due to match rescheduling
        matchday_labels = sorted(list(form.df.columns.unique(level=0)))
        # Remove 'Matchday' prefix and just store sorted integers
        x, matchday_labels, *ys = zip(*sorted(zip(x, matchday_labels, *ys)))

        return x, matchday_labels, ys

    @timebudget
    def update(self, form: Form, team: str = None, display: bool = False):
        if form.df.empty:
            raise ValueError('❌ [ERROR] Cannot generate form over time graph: Form dataframe is empty')
        
        team_names = form.df.index.values.tolist()
        
        teams_to_update = self._teams_to_update(
            team, team_names, 'form over time')

        x, matchday_labels, ys = self._data_points(form)

        for team_name in teams_to_update:
            fig = self._get_fig(
                x, ys, matchday_labels, team_name, team_names)

            if display:
                fig.show()

            self.save_fig(fig, team_name, 'form-over-time')


class PositionOverTime(Graph):
    
    @staticmethod
    def _plot_positions(
            fig: FigureWidget, 
            x: list[datetime],
            ys: list[list[float]], 
            team: str,
            team_names: list[str],
        ):
        for idx, y in enumerate(ys):
            if team_names[idx] != team:
                fig.add_trace(go.Scatter(x=x,
                                         y=y,
                                         name=team_names[idx],
                                         mode='lines',
                                         line=dict(color='#d3d3d3'),
                                         showlegend=False,
                                         hovertemplate=f'<b>{team_names[idx]}</b><br>' +
                                         'Matchday %{x}<br>%{y}th<extra></extra>',
                                         hoverinfo=('x+y'),
                                         ))
            else:
                # Save index the input teams is found for plotting the final line
                team_idx = idx

        # Add this as teams name last to have this line on top
        fig.add_trace(go.Scatter(x=x,
                                 y=ys[team_idx],
                                 name=team_names[team_idx],
                                 mode='lines',
                                 line=dict(color=utils.team_colours[team_names[team_idx]],
                                           width=4),
                                 showlegend=False,
                                 hovertemplate=f'<b>{team_names[team_idx]}</b><br>' +
                                 'Matchday %{x}<br>%{y}th<extra></extra>',
                                 hoverinfo=('x+y'),
                                 ))

    @staticmethod
    def _plot_position_rect(
            fig: FigureWidget, 
            x0: float, 
            y0: float, 
            x1: float, 
            y1: float, 
            colour: str,
        ):
        fig.add_shape(type='rect',
                      x0=x0,
                      y0=y0,
                      x1=x1,
                      y1=y1,
                      line=dict(
                          width=0,
                      ),
                      fillcolor=colour,
                      opacity=0.3,
                      layer='below')

    @staticmethod
    def _format_fig(
            fig: FigureWidget, 
            x: list[datetime],
            matchday_labels: list[str],
        ):
        positional_values = [i for i in range(1, 21)]

        fig.update_layout(
            autosize=True,
            yaxis=dict(
                title_text='League Position',
                ticktext=positional_values,
                tickvals=positional_values,
                autorange='reversed',
                showgrid=False,
                showline=False,
                zeroline=False,
                fixedrange=True
            ),
            xaxis=dict(
                title_text='Matchday',
                linecolor='black',
                tickmode='array',
                dtick=1,
                ticktext=matchday_labels,
                tickvals=x,
                showgrid=False,
                showline=False,
                fixedrange=True
            ),
            margin=dict(
                l=50,
                r=50,
                b=10,
                t=10,
                pad=4
            ),
            plot_bgcolor='#fafafa',
            paper_bgcolor='#fafafa',
        )

    def _get_fig(
            self, 
            x: list[datetime], 
            ys: list[list[int]],
            matchday_labels: list[str], 
            team: str, 
            team_names: list[str],
        ) -> FigureWidget:
        fig = go.Figure()
        self._plot_positions(fig, x, ys, team, team_names)
        # self._plot_position_rect(fig, x[0], 4.5, x[-1], 0.5, '#03AC13')  # Top 4
        self._plot_position_rect(fig, x[0], 4.5, x[-1], 0.5, '#77DD77')  # Top 4
        # self._plot_position_rect(fig, x[0], 6.5, x[-1], 4.5, '#008080)  # 5-6
        self._plot_position_rect(fig, x[0], 6.5, x[-1], 4.5, '#4cdeee')  # 5-6
        # self._plot_position_rect(fig, x[0], 6.5, x[-1], 4.5, '#0080FF')  # 5-6
        # self._plot_position_rect(fig, x[0], 20.5, x[-1], 17.5, '#800000')  # Relegation zone
        self._plot_position_rect(fig, x[0], 20.5, x[-1], 17.5, '#C23B22')  # Relegation zone
        self._format_fig(fig, x, matchday_labels)
        return fig

    @staticmethod
    def _x_data_points(form: Form) -> list[datetime]:
        x_cols = form.df.iloc[:, form.df.columns.get_level_values(1) == 'Date']

        x = []
        for _, col_data in x_cols.iteritems():
            # Take the median date for that matchday
            median_date = np.median(col_data.values.tolist())
            # Convert from numpy date to datetime format
            x.append(datetime.utcfromtimestamp(median_date/1e9))
        return x

    @staticmethod
    def _ys_data_points(form: Form) -> list[list[float]]:
        y_cols = form.df.iloc[:,
                              form.df.columns.get_level_values(1) == 'Position']

        ys = []
        for _, row_data in y_cols.iterrows():
            y = row_data.values.tolist()
            ys.append(y)
        return ys

    def _data_points(
            self, 
            form: Form
        ) -> tuple[list[datetime], list[str], list[list[int]]]:
        # All ys have the same x date values
        x = self._x_data_points(form)
        ys = self._ys_data_points(form)

        # Sort the x-axis data by date to remove errors due to match rescheduling
        matchday_labels = sorted(list(form.df.columns.unique(level=0)))

        x, matchday_labels, *ys = zip(*sorted(zip(x, matchday_labels, *ys)))

        return x, matchday_labels, ys

    @timebudget
    def update(self, form: Form, team: str = None, display: bool = False):
        if form.df.empty:
            raise ValueError(
                '❌ [ERROR] Cannot generate position over time graph: Form dataframe is empty')

        team_names = form.df.index.values.tolist()
        
        teams_to_update = self._teams_to_update(
            team, team_names, 'position over time')

        x, matchday_labels, ys = self._data_points(form)

        # Create a fig for each team
        for team_name in teams_to_update:
            fig = self._get_fig(
                x, ys, matchday_labels, team_name, team_names)

            if display:
                fig.show()

            self.save_fig(fig, team_name, 'position-over-time')


class GoalsScoredAndConceded(Graph):
    
    @staticmethod
    def _plot_clean_sheets(x: list[datetime], clean_sheets: list[int]):
        midline = [0.5]*len(x)

        fig = go.Figure(data=[
            go.Bar(name='Clean Sheets',
                   x=x,
                   y=[v if v == 1 else None for v in clean_sheets],
                   marker_color='#77DD77',
                #    marker_line_color='#006400',
                #    marker_line_width=2,
                   hovertemplate='Clean sheet<extra></extra>',
                   yaxis='y2'),
            go.Bar(name='Goals Conceded',
                   x=x,
                   y=[v if v == 1 else None for v in 1-clean_sheets],
                   marker_color='#C23B22',
                #    marker_line_color='#8B0000',
                #    marker_line_width=2,
                   hovertemplate='Goals conceded<extra></extra>',
                   yaxis='y2'),
            go.Scatter(name='Line',
                       x=x,
                       y=midline,
                       mode='lines',
                    #    line=dict(color='#757575',
                       line=dict(color='#9b9b9b',
                                 width=2),
                       hoverinfo='skip'),
        ])

        return fig

    @staticmethod
    def _format_clean_sheets_fig(
            fig: FigureWidget, 
            x: list[datetime],
            matchday_labels: list[str],
        ):
        # Config graph layout
        fig.update_layout(
            height=60,
            autosize=True,
            barmode='stack',
            yaxis=dict(
                autorange=False,
                range=[-0.2, 1.2],
                showgrid=False,
                showline=False,
                zeroline=False,
                showticklabels=False,
                dtick=1,
                fixedrange=True
            ),
            xaxis=dict(
                title_text='Matchday',
                tickmode='array',
                ticktext=matchday_labels,
                tickvals=x,
                showgrid=False,
                showline=False,
                fixedrange=True
            ),
            margin=dict(
                l=50,
                r=50,
                b=40,
                t=0,
                pad=4
            ),
            plot_bgcolor='#fafafa',
            paper_bgcolor='#fafafa',
            showlegend=False,
            yaxis2=dict(overlaying='y',
                        showticklabels=False,
                        zeroline=False,
                        showline=False,
                        showgrid=False)
        )

    def _clean_sheets_fig(
            self, 
            x: list[datetime], 
            clean_sheets: list[Optional[float]],
            matchday_labels: list[str],
        ) -> FigureWidget:
        fig = self._plot_clean_sheets(x, clean_sheets)
        self._format_clean_sheets_fig(fig, x, matchday_labels)
        return fig

    @staticmethod
    def _clean_sheets_data_points(y_goals_conceded: list[int]) -> list[int]:
        return (np.array(y_goals_conceded) == 0).astype(int)

    # ---------------------- GOALS SCORED AND CONCEDED -------------------------

    @staticmethod
    def _plot_goals_scored_and_conceded(
            x: list[datetime], 
            y_goals_scored: list[int],
            y_goals_conceded: list[int], 
            y_avg: list[float],
        ):
        fig = go.Figure(data=[
            go.Bar(name='Goals Scored', x=x, y=y_goals_scored,
                   marker_color='#77DD77',
                #    marker_line_color='#006400',
                #    marker_line_width=2,
                   hovertemplate='%{y} goals scored<extra></extra>',
                   hoverinfo=('y')),
            go.Bar(name='Goals Conceded', x=x, y=y_goals_conceded,
                   marker_color='#C23B22',
                #    marker_line_color='#8B0000',
                #    marker_line_width=2,
                   hovertemplate='%{y} goals conceded<extra></extra>',
                   hoverinfo=('y')),
            go.Scatter(name='Avg', x=x, y=y_avg, mode='lines',
                       hovertemplate='%{y} goals<extra></extra>',
                       line=dict(color='#0080FF', width=2))
        ])

        return fig

    @staticmethod
    def _format_goals_scored_and_conceded_fig(
            fig: FigureWidget,
            x: list[datetime], 
            y_goals_scored: list[int], 
            y_goals_conceded: list[int],
        ):
        # Get the maximum y-axis value (6 goals unless a higher value found)
        max_y = max(np.max(np.array(y_goals_scored) +
                    np.array(y_goals_conceded)), 7)

        # Config graph layout
        fig.update_layout(
            autosize=True,
            barmode='stack',
            yaxis=dict(
                title_text='Goals',
                autorange=False,
                range=[0, max_y],
                showgrid=False,
                showline=False,
                zeroline=False,
                dtick=1,
                fixedrange=True
            ),
            xaxis=dict(
                tickmode='array',
                tickvals=x,
                showgrid=False,
                showline=False,
                showticklabels=False,
                fixedrange=True
            ),
            margin=dict(l=50, r=50, b=10, t=10, pad=4),
            plot_bgcolor='#fafafa',
            paper_bgcolor='#fafafa',
            legend=dict(
                yanchor='top',
                y=0.99,
                xanchor='right',
                x=0.99
            ),
        )

    def _scored_and_conceded_fig(
            self, 
            x: list[datetime], 
            y_goals_scored: list[int],
            y_goals_conceded: list[int], 
            y_avg: list[float],
        ) -> FigureWidget:
        fig = self._plot_goals_scored_and_conceded(
            x, y_goals_scored, y_goals_conceded, y_avg)
        self._format_goals_scored_and_conceded_fig(
            fig, x, y_goals_scored, y_goals_conceded)
        return fig

    @staticmethod
    def _n_goals(team_matchday: dict) -> tuple[int, int]:
        home, _, away = team_matchday['Score'].split(' ')

        n_goals_scored, n_goals_conceded = map(int, (home, away))
        if not team_matchday['AtHome']:
            n_goals_scored, n_goals_conceded = n_goals_conceded, n_goals_scored

        return n_goals_scored, n_goals_conceded

    @staticmethod
    def _avg_goals(matchday_scorelines: list[str]) -> float:
        # Append the average goals for this matchday to average goals list
        goals_scored = []
        for scoreline in matchday_scorelines.values.tolist():
            if scoreline is not None:
                home, _, away = scoreline.split(' ')
                goals_scored.append(int(home) + int(away))
        # Append the mean goals scored (equal to mean goals conceded) this gameweek
        y_avg = sum(goals_scored) / len(goals_scored)
        return y_avg

    @staticmethod
    def _sort_by_x_axis(
            x: list[datetime], 
            y_goals_scored: list[int],
            y_goals_conceded: list[int], 
            y_avg: list[float],
        ) -> tuple[list[datetime], list[int], list[int], list[float]]:
        if x and y_goals_scored and y_goals_conceded and y_avg:
            x, y_goals_scored, y_goals_conceded, y_avg = map(
                list, zip(*sorted(zip(x, y_goals_scored, y_goals_conceded, y_avg))))
        return x, y_goals_scored, y_goals_conceded, y_avg

    def _data_points(
            self,
            form: Form,
            team: str,
        ) -> tuple[list[datetime], list[int], list[int], list[float], list[str]]:

                # Dates of matchdays that have been played
        x_cols = form.df.iloc[:, form.df.columns.get_level_values(1) == 'Date']
        # All y lists have the same x date values
        x = [datetime.utcfromtimestamp(date/1e9)
             for date in x_cols.loc[team].values.tolist()]

        # Create chart y values (2 bar charts, and the average line)
        y_goals_scored = []  # type: list[int]
        y_goals_conceded = []  # type: list[int]
        y_avg = []  # type: list[float]

        team_form = form.df.loc[team]

        matchday_nos = sorted(list(form.df.columns.unique(level=0)))
        for idx, matchday_no in enumerate(matchday_nos):
            # Append the teams number of goals scored and cocneded this matchday
            team_matchday = team_form[matchday_no]
            # If match has been played
            if team_matchday['Score'] is not None:
                matchday_scorelines = form.df[matchday_no]['Score']
                y_avg.append(self._avg_goals(matchday_scorelines))
                gs, gc = self._n_goals(team_matchday)
                y_goals_scored.append(gs)
                y_goals_conceded.append(gc)
            else:
                # Do not add goals scored, goals condeded or average goals graph points
                # Remove elements from other lists to ensure all lists will be same length
                del x[idx]
                del matchday_nos[idx]

        matchday_labels = list(map(str, matchday_nos))  # x labels
        
        x, y_goals_scored, y_goals_conceded, y_avg = self._sort_by_x_axis(
            x, y_goals_scored, y_goals_conceded, y_avg)

        return x, y_goals_scored, y_goals_conceded, y_avg, matchday_labels
    
    @timebudget
    def update(self, form: Form, team: str = None, display: bool = False):
        if form.df.empty:
            raise ValueError('❌ [ERROR] Cannot generate goals scored and conceded graph: Form dataframe is empty')

        teams_to_update = self._teams_to_update(
            team, form.df.index.values.tolist(), 'goals scored and conceded')

        for team_name in teams_to_update:
            x, y_goals_scored, y_goals_conceded, y_avg, matchday_labels = self._data_points(form, team_name)
            if y_goals_scored and y_goals_conceded:
                fig = self._scored_and_conceded_fig(x, y_goals_scored, y_goals_conceded, y_avg)

                if display:
                    fig.show()

                self.save_fig(fig, team_name, 'goals-scored-and-conceded')

            # EXTENSION GRAPH FROM SAME DATA: CLEAN SHEETS YES/NO + X-AXIS LABELS
            if x:
                clean_sheets = self._clean_sheets_data_points(y_goals_conceded)
                fig = self._clean_sheets_fig(x, clean_sheets, matchday_labels)

                if display:
                    fig.show()

                self.save_fig(fig, team_name, 'clean-sheets')
                
                
class GoalsScoredFrequency(Graph): 
    
    @staticmethod
    def _format_fig(
            fig: FigureWidget,
            avg_y,
            scored_y,
            conceded_y
        ):
        
        max_y = max(max(avg_y), max(scored_y), max(conceded_y)) + 0.5

        # Config graph layout
        fig.update_layout(
            autosize=True,
            barmode='overlay',
            bargap=0,
            yaxis=dict(
                title_text='Frequency',
                showgrid=False,
                showline=False,
                zeroline=False,
                dtick=1,
                fixedrange=True,
                range=[0, max_y]
            ),
            xaxis=dict(
                title_text='Goals',
                tickmode='array',
                showgrid=False,
                showline=False,
                fixedrange=True
            ),
            margin=dict(
                l=50,
                r=50,
                b=10,
                t=10,
                pad=4
            ),
            plot_bgcolor='#fafafa',
            paper_bgcolor='#fafafa',
            legend=dict(
                yanchor='top',
                y=0.99,
                xanchor='right',
                x=0.99
            ),
        ) 
        
    @staticmethod
    def _avg_goals_dict(goals_scored_freq_dict):
        avg_goals_scored = defaultdict(lambda: 0)
        for goals_scored_freq in goals_scored_freq_dict.values():
            for goals_scored, freq in goals_scored_freq.items():
                avg_goals_scored[goals_scored] += freq
        
        for goals_scored in avg_goals_scored:
            avg_goals_scored[goals_scored] /= 20
        
        return avg_goals_scored
    
    def _frequency_dicts(self, form: Form):
        goals_scored_freq_dict = {}  # (goals scored : frequency) for each team
        goals_conceded_freq_dict = {}  # (goals scored : frequency) for each team
        
        for row in form.df.iterrows():
            team_name = row[0]
            goals_scored_freq_dict[team_name] = defaultdict(lambda: 0)
            goals_conceded_freq_dict[team_name] = defaultdict(lambda: 0)
            
            for matchday_n in row[1].index.get_level_values(0).unique():
                score = row[1][(matchday_n, 'Score')]
                if score is not None:
                    h, a = utils.extract_int_score(score)
                    at_home = row[1][(matchday_n, 'AtHome')]
                    if at_home:
                        goals_scored_freq_dict[team_name][h] += 1
                        goals_conceded_freq_dict[team_name][a] += 1
                    else:
                        goals_scored_freq_dict[team_name][a] += 1
                        goals_conceded_freq_dict[team_name][h] += 1
        
        avg_goals_dict = self._avg_goals_dict(goals_scored_freq_dict)
        
        return goals_scored_freq_dict, goals_conceded_freq_dict, avg_goals_dict
    
    @staticmethod
    def _data_points(goals_scored_freq, goals_conceded_freq, avg_goals_scored_freq, team_name):
        avg_xypairs = sorted([(k, v) for k, v in avg_goals_scored_freq.items()])
        x = [v[0] for v in avg_xypairs]  # Same x for both graphs
        avg_y = [v[1] for v in avg_xypairs]
        
        scored_xypairs = sorted([(k, v) for k, v in goals_scored_freq[team_name].items()])
        scored_y = [v[1] for v in scored_xypairs]
        
        conceded_xypairs = sorted([(k, v) for k, v in goals_conceded_freq[team_name].items()])
        conceded_y = [v[1] for v in conceded_xypairs]
        
        return x, scored_y, conceded_y, avg_y
    
    def update(self, form: Form, team: str = None, display: bool = False):
        if form.df.empty:
            raise ValueError('❌ [ERROR] Cannot generate goals scored and conceded graph: Form dataframe is empty')
        
        team_names = form.df.index.values.tolist()
        
        teams_to_update = self._teams_to_update(
            team, team_names, 'goals frequency')
        
        goals_scored_freq, goals_conceded_freq, avg_goals_freq = self._frequency_dicts(form)
        
        for team_name in teams_to_update:
            x, scored_y, conceded_y, avg_y = self._data_points(
                goals_scored_freq, goals_conceded_freq, avg_goals_freq, team_name)
            
            fig = go.Figure(data=[
                go.Bar(name='Avg',
                       x=x,
                       y=avg_y,
                       marker_color='#d3d3d3',
                       marker_line_width=0,
                       hovertemplate='%{x} goals: %{y}<extra></extra>',
                       hoverinfo=('x+y')),
                go.Bar(name='Scored',
                       x=x,
                       y=scored_y,
                       marker_color='#77DD77',
                       marker_line_width=0,
                       hovertemplate='%{x} goals scored: %{y}<extra></extra>',
                       hoverinfo=('x+y'),
                       opacity=0.6),
            ])
            
            self._format_fig(fig, avg_y, scored_y, conceded_y)
            
            if display:
                fig.show()
            
            self.save_fig(fig, team_name, 'goals-scored-frequency')
            
            fig = go.Figure(data=[
                go.Bar(name='Avg',
                       x=x,
                       y=avg_y,
                       marker_color='#d3d3d3',
                       marker_line_width=0,
                       hovertemplate='%{x} goals: %{y}<extra></extra>',
                       hoverinfo=('x+y')),
                go.Bar(name='Conceded',
                       x=x,
                       y=conceded_y,
                       marker_color='#C23B22',
                       marker_line_width=0,
                       hovertemplate='%{x} goals conceded: %{y}<extra></extra>',
                       hoverinfo=('x+y'),
                       opacity=0.6),
            ])
            
            self._format_fig(fig, avg_y, scored_y, conceded_y)
            
            if display:
                fig.show()
            
            self.save_fig(fig, team_name, 'goals-conceded-frequency')

        
        


class Visualiser:
    def __init__(self):
        self.fixtures_graph = Fixtures()
        self.form_over_time_graph = FormOverTime()
        self.position_over_time_graph = PositionOverTime()
        self.goals_scored_and_conceded_graph = GoalsScoredAndConceded()
        self.goals_scored_frequency_graph = GoalsScoredFrequency()

    def update(
            self, 
            fixtures: Fixtures, 
            team_ratings: TeamRatings,
            home_advantages: HomeAdvantages, 
            form: Form, 
            team: str = None,
            display_graphs: bool = False
        ):
        self.fixtures_graph.update(
            fixtures, 
            team_ratings, 
            home_advantages, 
            team=team, 
            display=display_graphs
        )
        self.form_over_time_graph.update(
            form,
            team=team,
            display=display_graphs
        )
        self.position_over_time_graph.update(
            form,
            team=team,
            display=display_graphs
        )
        self.goals_scored_and_conceded_graph.update(
            form,
            team=team,
            display=display_graphs
        )
        self.goals_scored_frequency_graph.update(
            form, 
            team=team, 
            display=display_graphs
        )
        
