from numpy.core.numeric import NaN
import plotly
import plotly.graph_objects as go
import numpy as np
from datetime import datetime
from timebudget import timebudget

class DataVis:
    def __init__(self):
        # Fixture graph
        self.fixtures_colour_scale = ['#01c626', '#08a825',  '#0b7c20', '#0a661b', '#064411',
                                      '#000000', '#5b1d15', '#85160f', '#ad1a10', '#db1a0d', '#fc1303']
    
        self.team_colours = {
            'Sheffield United FC': 'rgb(238, 39, 55)',
            'Leeds United FC': 'rgb(255, 205, 0)',
            'Aston Villa FC': 'rgb(103, 14, 54)',
            'Fulham FC': 'rgb(204, 0, 0)',
            'Wolverhampton Wanderers FC': 'rgb(253, 185, 19)',
            'West Ham United FC': 'rgb(122, 38, 58)',
            'West Bromwich Albion FC': 'rgb(18, 47, 103)',
            'Tottenham Hotspur FC': 'rgb(19, 34, 87)',
            'Southampton FC': 'rgb(215, 25, 32)',
            'Newcastle United FC': 'rgb(45, 41, 38)',
            'Manchester United FC':  'rgb(218, 41, 28)',
            'Manchester City FC': 'rgb(108, 171, 221)',
            'Liverpool FC': 'rgb(200, 16, 46)',
            'Leicester City FC': 'rgb(0, 83, 160)',
            'Everton FC': 'rgb(39, 68, 136)',
            'Crystal Palace FC': ' rgb(27, 69, 143)',
            'Chelsea FC': 'rgb(3, 70, 148)',
            'Burnley FC': 'rgb(108, 29, 69)',
            'Brighton and Hove Albion FC': 'rgb(0, 87, 184)',
            'Arsenal FC': 'rgb(239, 1, 7)',
            'Norwich City FC': 'rgb(0, 166, 80)',
            'Cardiff City FC': 'rgb(0, 112, 181)',
            'Watford FC': 'rgb(237, 33, 39)',
            'Swansea City FC': 'rgb(18, 18, 18)',
            'Stoke City FC': 'rgb(224, 58, 62)',
            'Huddersfield FC': 'rgb(14, 99, 173)',
            'Bournemouth FC': 'rgb(218, 41, 28)',
        }
    
    
    
    
    # ------------ FIXTURES GRAPHS -------------
    
    @timebudget
    def updateFixtures(self, fixtures, team_ratings, home_advantages, display=False, team_name=None):
        if team_name == None:
            print("Updating all team fixtures graphs...")
            for team in fixtures.index.values.tolist():
                self.genFixturesGraph(team, fixtures, team_ratings, home_advantages, display=display)
        else:
            print(f"Updating {team_name} fixture graph...")
            self.genFixturesGraph(team_name, fixtures, team_ratings, home_advantages, display=display)
    
    def genFixturesGraph(self, team_name, fixtures, team_ratings, home_advantages, display=False):
        """Creates and saves a plotly scatter graph that displays the teams past
           and future fixtures for the current season. The graph is produced using
           filled values from the fixtures, team_ratings and home_advantages 
           dataframes. Home advantages are taken into account, and any team, when
           playing away, have the other teams home advantage subtracted from their 
           rating.
           Graph: calculated team ratings (%) vs matchday number

        Args:
            team_name ([type]): [description]
            fixtures ([type]): [description]
            team_ratings ([type]): [description]
            home_advantages ([type]): [description]
            display (bool, optional): [description]. Defaults to False.
        """
        DEFAULT_MARKER_SIZE = 14
        BIG_MARKER_SIZE = 26  # Used to highlight next game
        
        # Get row of fixtures dataframe
        team_fixtures = fixtures.loc[team_name]

        n_matches = len(team_fixtures.index.levels[0])

        now = datetime.now()
        sizes = [DEFAULT_MARKER_SIZE] * n_matches  # Sizes of each data point marker

        x, y, details = [], [], []
        for i in range(n_matches):
            match = team_fixtures[f'Matchday {i+1}']
            
            # Append single datetime value of matchday to x-axis 
            x.append(datetime.utcfromtimestamp(match['Date'].tolist()/1e9))
            
            # Get rating of the opposition team
            rating = team_ratings.loc[match['Team'], 'Total Rating']
            # Decrease other team's rating if you're playing at home
            if match['HomeAway'] == 'Home':
                rating *= (1 - home_advantages.loc[match['Team'], 'Total Home Advantage'][0])
            # Append percentage rating value of opposition team playing on this matchday
            y.append(rating*100)

            # Add team played, home or away and the final score if game has already happened
            if match['Score'] != "None - None":
                match_detail = f"{match['Team']} ({match['HomeAway']})  {match['Score']}"
            else:
                match_detail = f"{match['Team']} ({match['HomeAway']})"
            details.append(match_detail)
            
            # Increase size of point marker if it's the current upcoming match
            if i == 0: 
                # If we haven't played first game of season
                if now < x[-1]:
                    sizes[i] = BIG_MARKER_SIZE
            elif i != n_matches and x[-2] < now <= x[-1]:
                sizes[i] = BIG_MARKER_SIZE
        
        # Sort the data by date to remove errors due to match rescheduling
        x, y, details = zip(*sorted(zip(x, y, details)))

        fig = go.Figure(data=go.Scatter(x=x, y=y, mode='lines+markers',
                                        marker=dict(size=sizes,
                                                    color=y,
                                                    colorscale=self.fixtures_colour_scale),
                                        line=dict(color='#737373'),
                                        text=details,
                                        hovertemplate="<b>%{text}</b><br>%{x|%d %b %Y}<br>Team rating: <b> %{y:.1f}%</b><extra></extra>",
                                        hoverinfo=('x+y+text'),
                                        ),
                        )

        fig.add_shape(go.layout.Shape(type="line",
                                      yref="paper",
                                      xref="x",
                                      x0=now,
                                      y0=0.04,
                                      x1=now,
                                      y1=1.01,
                                      line=dict(color="black",
                                                width=1,
                                                dash="dot")))
        
        fig.update_layout(
            yaxis=dict(
                title_text="Calculated Team Rating",
                ticktext=[str(i) + "%" for i in range(0, 101, 10)],
                tickvals=[i for i in range(0, 101, 10)],
                gridcolor='gray',
                showline=False,
                zeroline=False,
                
            ),
            xaxis=dict(
                title_text="Matchday",
                linecolor="black",
                showgrid=False,
                showline=False,

                ticktext=[i for i in range(2, len(x)+2, 2)],
                tickvals=[x[i] for i in range(1, len(x)+1, 2)],
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

        if display:
            fig.show()
        # Convert team name into suitable use for filename
        file_team_name = '-'.join(team_name.lower().split()[:-1]).replace('&', 'and')
        plotly.offline.plot(
            fig, filename=f'./templates/graphs/{file_team_name}/fixtures-{file_team_name}.html', auto_open=False, config={'displayModeBar': False, 'scrollZoom': False})
    
    
    # ------------- FORM OVER TIME GRAPHS -------------
    
    @timebudget
    def updateFormOverTime(self, form, display=False, team_name=None):
        if team_name == None:
            print("Updating all teams form over time graphs...")
            for team in form.index.values.tolist():
                self.genFormOverTimeGraph(team, form, display=display)
        else:
            print(f"Updating {team_name} form over time graph...")
            self.genFormOverTimeGraph(team_name, form, display=display)
    
    def genFormOverTimeGraph(self, team_name, form, display=False):
        x_cols = form.iloc[:, form.columns.get_level_values(1) == 'Date']
        y_cols = form.iloc[:, form.columns.get_level_values(1) == 'Form Rating %']
        
                        
        # All ys have the same x date values
        x = []
        for _, col_data in x_cols.iteritems():
            # Take the median date for that matchday
            median_date = np.median(col_data.values.tolist())
            # Convert from numpy date to datetime format
            x.append(datetime.utcfromtimestamp(median_date/1e9))

        ys = []
        for _, row_data in y_cols.iterrows():
            y = row_data.values.tolist()
            ys.append(y)

        names = form.index.values.tolist()
        
        fig = go.Figure()
        
        # Sort the x-axis data by date to remove errors due to match rescheduling
        cols = list(form.columns.unique(level=0))
        # Remove 'Matchday' prefix and just store sorted integers
        matchday_labels = sorted(map(lambda x: int(x.split(' ')[-1]), cols))
        x, matchday_labels, *ys = zip(*sorted(zip(x, matchday_labels, *ys)))
                
        for idx, y in enumerate(ys):
            if names[idx] != team_name:
                fig.add_trace(go.Scatter(x=x, 
                                         y=y, 
                                         name=names[idx],
                                         mode='lines',
                                         line=dict(color='#d3d3d3'),
                                         showlegend=False,
                                         hovertemplate=f"<b>{names[idx]}</b><br>" + "Matchday %{x}<br>Form: <b>%{y:.1f}%</b><extra></extra>",
                                         hoverinfo=('x+y'),
                                         ))
            else:
                # Save index the input teams is found for plotting the final line
                team_idx = idx
        
        # Add this as teams name last to have this line on top
        fig.add_trace(go.Scatter(x=x,
                                 y=ys[team_idx],
                                 name=names[team_idx],
                                 mode='lines',
                                 line=dict(color=self.team_colours[names[team_idx]],
                                           width=4),
                                 showlegend=False,
                                 hovertemplate=f"<b>{names[team_idx]}</b><br>" + "Matchday %{x}<br>Form: <b>%{y:.1f}%</b><extra></extra>",
                                 hoverinfo=('x+y'),
                                 ))
        fig.update_layout(
            yaxis=dict(
                title_text="Form Rating %",
                ticktext=([i for i in range(0, 101, 10)]),
                tickvals=([i for i in range(0, 101, 10)]),
                showgrid=False,
                showline=False,
                zeroline=False,
            ),
            xaxis=dict(
                title_text="Matchday",
                linecolor="black",
                tickmode="array",
                dtick=1,
                ticktext=[str(i) for i in matchday_labels],
                tickvals=x,
                showgrid=False,
                showline=False,
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
        

        if display:
            fig.show()
        
        # Format and save team name
        file_team_name = '-'.join(team_name.lower().split()[:-1]).replace('&', 'and')
        plotly.offline.plot(fig, filename=f'./static/graphs/{file_team_name}/form-over-time-{file_team_name}.html', auto_open=False, config={'displayModeBar': False, 'scrollZoom': False})



    
    # ---------- POSITION OVER TIME GRAPHS ----------
    
    @timebudget
    def updatePositionOverTime(self, position_over_time, display=False, team_name=None):
        if team_name == None:
            print("Updating all teams positions over time graphs...")
            for team in position_over_time.index.values.tolist():
                self.genPositionOverTimeGraph(team, position_over_time, display=display)
        else:
            print(f"Updating {team_name} positions over time graph...")
            self.genPositionOverTimeGraph(team_name, position_over_time, display=display)
        
    def genPositionOverTimeGraph(self, team_name, position_over_time, display=False):
        """Creates and saves a plotly line graph displaying the Premier League 
           table position a team has been in at the end of each matchday that has 
           played at the time of creation. The graph is produced using the 
           position_over_time dataframe. The graph displays a faint light grey
           line for each other team in the Premier League, with the final line plotted 
           for the input team, coloured in the teams brand colours.
           The y axis has been reversed and moves from 20 (at the x-axis) to 1.
           Graph: position in Premier League table vs matchday number

        Args:
            team_name ([type]): [description]
            position_over_time ([type]): [description]
            display (bool, optional): [description]. Defaults to False.
        """
        x_cols = position_over_time.iloc[:, position_over_time.columns.get_level_values(1) == 'Date']
        y_cols = position_over_time.iloc[:, position_over_time.columns.get_level_values(1) == 'Position']

        # All ys have the same x date values
        x = []
        for _, col_data in x_cols.iteritems():
            # Take the median date for that matchday
            median_date = np.median(col_data.values.tolist())
            # Convert from numpy date to datetime format
            x.append(datetime.utcfromtimestamp(median_date/1e9))

        ys = []
        for _, row_data in y_cols.iterrows():
            y = row_data.values.tolist()
            ys.append(y)

        names = position_over_time.index.values.tolist()
        
        # Sort the x-axis data by date to remove errors due to match rescheduling
        cols = list(position_over_time.columns.unique(level=0))
        # Remove 'Matchday' prefix and just store sorted integers
        matchday_labels = sorted(map(lambda x: int(x.split(' ')[-1]), cols))
        x, matchday_labels, *ys = zip(*sorted(zip(x, matchday_labels, *ys)))
        
        
        fig = go.Figure()
        for idx, y in enumerate(ys):
            if names[idx] != team_name:
                fig.add_trace(go.Scatter(x=x, 
                                         y=y, 
                                         name=names[idx],
                                         mode='lines',
                                         line=dict(color='#d3d3d3'),
                                         showlegend=False,
                                         hovertemplate=f"<b>{names[idx]}</b><br>" + "Matchday %{x}<br>%{y}th<extra></extra>",
                                         hoverinfo=('x+y'),
                                         ))
            else:
                # Save index the input teams is found for plotting the final line
                team_idx = idx
        # Add this as teams name last to have this line on top
        fig.add_trace(go.Scatter(x=x,
                                 y=ys[team_idx],
                                 name=names[team_idx],
                                 mode='lines',
                                 line=dict(color=self.team_colours[names[team_idx]],
                                           width=4),
                                 showlegend=False,
                                 hovertemplate=f"<b>{names[team_idx]}</b><br>" + "Matchday %{x}<br>%{y}th<extra></extra>",
                                 hoverinfo=('x+y'),
                                 ))
        
        # Add background yellow zone for star teams zone
        fig.add_shape(type="rect",
                    x0=x[0],
                    y0=4,
                    x1=x[-1],
                    y1=1,
                    line=dict(
                        width=0,
                    ),
                    fillcolor="#03AC13",
                    opacity=0.3,
                    layer="below",
        )
        fig.add_shape(type="rect",
                    x0=x[0],
                    y0=6,
                    x1=x[-1],
                    y1=4,
                    line=dict(
                        width=0,
                    ),
                    fillcolor="#008080",
                    opacity=0.3,
                    layer="below",
        )
        fig.add_shape(type="rect",
                    x0=x[0],
                    y0=20,
                    x1=x[-1],
                    y1=17,
                    line=dict(
                        width=0,
                    ),
                    fillcolor="#800000",
                    opacity=0.3,
                    layer="below",
        )
        
        fig.update_layout(
            yaxis=dict(
                title_text="League Position",
                ticktext=([i for i in range(1, 21)]),
                tickvals=([i for i in range(1, 21)]),
                autorange="reversed",
                showgrid=False,
                showline=False,
                zeroline=False,
            ),
            xaxis=dict(
                title_text="Matchday",
                linecolor="black",
                tickmode="array",
                dtick=1,
                ticktext=[str(i) for i in matchday_labels],
                tickvals=x,
                showgrid=False,
                showline=False,
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

        if display:
            fig.show()
        
        file_team_name = '-'.join(team_name.lower().split()[:-1]).replace('&', 'and')
        plotly.offline.plot(
            fig, filename=f'./static/graphs/{file_team_name}/position-over-time-{file_team_name}.html', auto_open=False, config={'displayModeBar': False, 'scrollZoom': False})
    
    
    
    
    # -------------- GOALS SCORED AND CONCEDED GRAPHS -------------
    
    @timebudget
    def updateGoalsScoredAndConceded(self, position_over_time, display=False, team_name=None):
        if team_name == None:
            print("Updating all teams goals scored and conceded over time graphs...")
            for team in position_over_time.index.values.tolist():
                self.genGoalsScoredAndConceded(team, position_over_time, display=display)
        else:
            print(f"Updating {team_name} goals scored and conceded over time graph...")
            self.genGoalsScoredAndConceded(team_name, position_over_time, display=display)
    
    def genGoalsScoredAndConceded(self, team_name, position_over_time, display=False):
        """Creates and saves a plotly bar graph displaying the goals scored and 
           goals conceded in each game played so far. The graph is produced using 
           the position_over_time dataframe. For each matchday there is a pair 
           of bars coloured green and the other red.
           Graph: number of goals vs matchday number

        Args:
            team_name ([type]): [description]
            position_over_time ([type]): [description]
            display (bool, optional): [description]. Defaults to False.
        """
        x_cols = position_over_time.iloc[:, position_over_time.columns.get_level_values(1) == 'Date']
        # All ys have the same x date values
        x = [datetime.utcfromtimestamp(date/1e9) for date in x_cols.loc[team_name].values.tolist()]
        
        # Create chart y values (2 bar charts, and the average line)
        y_goals_scored, y_goals_conceded, y_avg = [], [], []
        team_position_over_time = position_over_time.loc[team_name]
        # no_matchdays = len(set([x[0] for x in team_position_over_time.index]))
        
        cols = list(position_over_time.columns.unique(level=0))
        # Remove 'Matchday' prefix and just store sorted integers
        matchday_labels = sorted(map(lambda x: int(x.split(' ')[-1]), cols))
        
        # List of matchday strings that have had all games play
        for matchday_no in matchday_labels:
            # Append the average goals for this matchday to average goals list
            matchday_scorelines = position_over_time[f'Matchday {matchday_no}']['Score']
            goals_scored = []
            for scoreline in matchday_scorelines.values.tolist():
                if type(scoreline) is str:
                    home, _, away = scoreline.split(' ')
                    goals_scored.extend([int(home), int(away)])
            # Append the mean goals scored (equal to mean goals conceded) this gameweek
            y_avg.append(sum(goals_scored) / len(goals_scored))
                       
            # Append the teams number of goals scored and cocneded this matchday
            team_matchday = team_position_over_time[f'Matchday {matchday_no}']
            if type(team_matchday['Score']) is str:  # If match has been played
                home, _, away = team_matchday['Score'].split(' ')
                no_goals_scored, no_goals_conceded = 0, 0
                if team_matchday['HomeAway'] == 'Home':
                    no_goals_scored = int(home)
                    no_goals_conceded = int(away)
                elif team_matchday['HomeAway'] == 'Away':
                    no_goals_scored = int(away)
                    no_goals_conceded = int(home)
            else:
                no_goals_scored = 0
                no_goals_conceded = 0
            y_goals_scored.append(no_goals_scored)
            y_goals_conceded.append(no_goals_conceded)
            
        x, y_goals_scored, y_goals_conceded, y_avg = map(list, zip(*sorted(zip(x, y_goals_scored, y_goals_conceded, y_avg))))

        # Plot graph
        fig = go.Figure(data=[
            go.Bar(name='Goals Scored', x=x, y=y_goals_scored,
                    marker_color='#77DD77',
                    marker_line_color='#006400',
                    marker_line_width=2,
                    hovertemplate="Matchday %{x}<br>%{y} goals scored<extra></extra>",
                    hoverinfo=('x+y')),
            go.Bar(name='Goals Conceded', x=x, y=y_goals_conceded,
                    marker_color='#C23B22',
                    marker_line_color='#8B0000',
                    marker_line_width=2,
                    hovertemplate="Matchday %{x}<br>%{y} goals conceded<extra></extra>",
                    hoverinfo=('x+y')),
            go.Scatter(name='Avg', x=x, y=y_avg, mode='lines',
                       hovertemplate="Matchday %{x}<br>%{y} goals scored on average<extra></extra>",
                       line=dict(color='#0080FF', width=2))
        ])
        
        # Get the maximum y-axis value (6 goals unless a higher value found)
        max_y = max([max(y_goals_scored), max(y_goals_conceded)])
        if max_y < 6:
            max_y = 6
        
        # Config graph layout
        fig.update_layout(
            barmode='group',
            yaxis=dict(
                title_text="Goals",
                autorange=False,
                range=[0, max_y],
                showgrid=False,
                showline=False,
                zeroline=False,
                dtick=1,
            ),
            xaxis=dict(
                title_text="Matchday",
                tickmode="array",
                ticktext=[str(i) for i in matchday_labels],
                tickvals=x,
                showgrid=False,
                showline=False,
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
                yanchor="top",
                y=0.99,
                xanchor="left",
                x=0.01
            ),
        )
        fig.update_layout(barmode='group')
        
        
        if display:
            fig.show()
        
        file_team_name = '-'.join(team_name.lower().split()[:-1]).replace('&', 'and')
        plotly.offline.plot(fig, filename=f'./static/graphs/{file_team_name}/goals-scored-and-conceded-{file_team_name}.html', auto_open=False, config={'displayModeBar': False, 'scrollZoom': False})
        
        
    def updateAll(self, fixtures, team_ratings, home_advantages, form, position_over_time, team_name=None, display_graphs=False):
        self.updateFixtures(fixtures, team_ratings, home_advantages, display=display_graphs, team_name=team_name)
        self.updateFormOverTime(form, display=display_graphs, team_name=team_name)
        self.updatePositionOverTime(position_over_time, display=display_graphs, team_name=team_name)
        self.updateGoalsScoredAndConceded(position_over_time, display=display_graphs, team_name=team_name)