import plotly
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
from datetime import datetime


class GenDataVis:
    
    team_colours = {
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
    
    def genFixturesGraph(self, team_name, fixtures, team_ratings, home_advantages, display=False):
        # Get row of fixtures dataframe
        team_fixtures = fixtures.loc[team_name]

        n_matches = len(team_fixtures.index.levels[0])
        now = datetime.now()
        sizes = [14] * n_matches

        x, y, details = [], [], []
        for i in range(n_matches):
            match = team_fixtures[f'Matchday {i+1}']

            x.append(datetime.utcfromtimestamp(match['Date'].tolist()/1e9))

            # Get rating of the opposition team
            rating = team_ratings.loc[match['Team'], 'Total Rating']
            # Decrease other team's rating if you're playing at home
            if match['HomeAway'] == 'Home':
                rating *= (1 -
                           home_advantages.loc[match['Team'], 'Total Home Advantage'][0])
            y.append(rating)

            # Add team played, home or away and the final score if game has already happened
            match_detail = f"{match['Team']} ({match['HomeAway']})"
            if match['Score'] != "None - None":
                match_detail += f"  {match['Score']}"
            details.append(match_detail)
            # Increase size of point marker if it's the current upcoming match
            if i == 0:
                if now < x[-1]:
                    sizes[i] = 26
            elif i != len(team_fixtures) and x[-2] < now <= x[-1]:
                sizes[i] = 26

        y = list(map(lambda x: x*100, y))  # Convert to percentages

        df = pd.DataFrame({'Date': x, 'Ratings': y, 'Teams': details})
        
        # fig = px.line(df, x="Date", y="Match", color='country')
        colour_scale = ['#01c626', '#08a825',  '#0b7c20', '#0a661b', '#064411',
                        '#000000', '#85160f', '#5b1d15', '#ad1a10', '#db1a0d', '#fc1303']
        fig = go.Figure(data=go.Scatter(x=x, y=y, mode='lines+markers',
                                        marker=dict(size=sizes,
                                                    color=y,
                                                    colorscale=colour_scale),
                                        line=dict(color='#737373'),
                                        text=details,
                                        hovertemplate="<b>%{text}</b> <br>%{x|%d %B, %Y}<br>Rating: %{y:.2f}%<extra></extra>",
                                        hoverinfo=('x+y+text'),
                                        ))

        fig.add_shape(go.layout.Shape(type="line",
                                      yref="paper",
                                      xref="x",
                                      x0=now,
                                      y0=0.04,
                                      x1=now,
                                      y1=1.01,
                                      # line=dict(color="RoyalBlue", width=3),),
                                      line=dict(color="black",
                                                width=1,
                                                dash="dot")))
        fig.update_layout(
            yaxis=dict(
                title_text="Calculated Team Rating %",
                ticktext=[str(i) + "%" for i in range(0, 101, 10)],
                tickvals=[i for i in range(0, 101, 10)],
                gridcolor='gray',
                showline=False,
                # color="black"
                zeroline=False,
            ),
            xaxis=dict(
                title_text="Matchday",
                linecolor="black",
                showgrid=False,
                showline=False,
                ticktext=[i for i in range(1, len(x)+1, 2)],
                tickvals=[x[i] for i in range(0, len(x), 2)],
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

        # fig.update_yaxes(showgrid=True, gridwidth=1, gridcolor='gray')
        # fig.update_xaxes(showgrid=False)
        if display:
            fig.show()
        # Convert team name into suitable use for filename
        file_team_name = '_'.join(team_name.lower().split()[:-1]).replace('&', 'and')
        plotly.offline.plot(
            fig, filename=f'./templates/graphs/{file_team_name}/fixtures_{file_team_name}.html', auto_open=False, config={'displayModeBar': False})

    def genPositionOverTimeGraph(self, team_name, position_over_time, display=False):
        x_cols = position_over_time.iloc[:, position_over_time.columns.get_level_values(1) == 'Date']
        y_cols = position_over_time.iloc[:, position_over_time.columns.get_level_values(1) == 'Position']

        # All ys have the same x date values
        x = []
        for _, col_data in x_cols.iteritems():
            # Take the mean date for that matchday
            # Convert from numpy date to datetime format
            mean_date = sum(col_data.values.tolist()) / \
                len(col_data.values.tolist())
            x.append(datetime.utcfromtimestamp(mean_date/1e9))

        ys = []
        for row_name, row_data in y_cols.iterrows():
            y = row_data.values.tolist()
            ys.append(y)

        names = position_over_time.index.values.tolist()
        
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
        # Add this as teams name last to have this line on top
        for idx, y in enumerate(ys):
            if names[idx] == team_name:
                fig.add_trace(go.Scatter(x=x,
                                         y=y,
                                         name=names[idx],
                                         mode='lines',
                                         line=dict(color=self.team_colours[names[idx]]),
                                         showlegend=False,
                                         hovertemplate=f"<b>{names[idx]}</b><br>" + "Matchday %{x}<br>%{y}th<extra></extra>",
                                         hoverinfo=('x+y'),
                                         ))
                break

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
                ticktext=[str(i) for i in range(1, len(x)+1)],
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
        
        file_team_name = '_'.join(team_name.lower().split()[:-1]).replace('&', 'and')
        plotly.offline.plot(
            fig, filename=f'./templates/graphs/{file_team_name}/position_over_time_{file_team_name}.html', auto_open=False, config={'displayModeBar': False})
    
    def genGoalsScoredAndConceded(self, team_name, position_over_time, display=False):
        x_cols = position_over_time.iloc[:, position_over_time.columns.get_level_values(1) == 'Date']
        x_cols = x_cols.loc[team_name]
        
        # All ys have the same x date values
        x = [datetime.utcfromtimestamp(date/1e9) for date in x_cols.values.tolist()]
        
        team_position_over_time = position_over_time.loc[team_name]
                
        y_goals_scored = []
        y_goals_conceded = []
        
        no_matchdays = len(set([x[0] for x in team_position_over_time.index]))
        y_goals_scored = []
        y_goals_conceded = []
        for i in range(no_matchdays):
            matchday = team_position_over_time[f'Matchday {i+1}']
            
            if type(matchday['Score']) is str:
                home, _, away = matchday['Score'].split(' ')
                if matchday['HomeAway'] == 'Home':
                    goals_scored = int(home)
                    goals_conceded = int(away)
                elif matchday['HomeAway'] == 'Away':
                    goals_scored = int(away)
                    goals_conceded = int(home)
                y_goals_scored.append(goals_scored)
                y_goals_conceded.append(goals_conceded)
            else:
                y_goals_scored.append(0)
                y_goals_conceded.append(0)
        
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
                    hoverinfo=('x+y'))
        ])
        
        max_y = max([max(y_goals_scored), max(y_goals_conceded)])
        if max_y < 6:
            max_y = 6
        
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
                # ticktext=[str(i) for i in range(0, 6)],
                # tickvals=[i for i in range(0, 6)],
            ),
            xaxis=dict(
                title_text="Matchday",
                tickmode="array",
                ticktext=[str(i) for i in range(1, len(x)+1)],
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
        fig.update_layout(barmode='group')
        
        if display:
            fig.show()
        
        file_team_name = '_'.join(team_name.lower().split()[:-1]).replace('&', 'and')
        plotly.offline.plot(fig, filename=f'./templates/graphs/{file_team_name}/goals_scored_and_conceded_{file_team_name}.html', auto_open=False, config={'displayModeBar': False})
        
        
