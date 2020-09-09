import plotly
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd

class GenDataVis:
    def genFixturesGraph(self, team_name, fixtures, team_ratings):
        team_fixtures = fixtures[team_name]
                
        x, y, teams = [], [], []
        for match in team_fixtures:
            x.append(match['Date'])
            rating = team_ratings.loc[team_ratings['Team'] == match['Team']].iloc[0]['Total Rating']
            y.append(rating)
            teams.append(match['Team'])
            
        df = pd.DataFrame({'Date': x, 'Ratings': y, 'Teams': teams})
        
        # fig = px.line(df, x="Date", y="Match", color='country')
        colour_scale = ['#15f00a', '#19c910',  '#18a811', '#137a0d', '#0d5209', '#000000', '#85160f', '#5b1d15', '#ad1a10', '#db1a0d', '#fc1303']
        fig = go.Figure(data=go.Scatter(x=x, y=y, mode='lines+markers', 
                                        marker=dict(size=15,
                                                    color=y,
                                                    colorscale=colour_scale),
                                        line=dict(color='#737373'),
                                        text=teams,
                                        hoverinfo=('y+text')))
        
        # fig = px.scatter(df, x='Date', y='Ratings', labels={'x':'Date', 'y':'Team Rating'},
        #                   color=y, color_continuous_scale=colour_scale, 
        #                   hover_name=teams)
        # fig = px.line(x=x, y=y)
        
        # Annotations
        # annotations = []
        # Title
        # annotations.append(dict(xref='paper', yref='paper', x=0.0, y=1.03,
        #                       xanchor='left', yanchor='bottom',
        #                       text=f'{team_name} Fixtures',
        #                       font=dict(family='Arial',
        #                                 size=32,
        #                                 color='rgb(37,37,37)'),
        #                       showarrow=False))
        
        
        # fig.update_layout(annotations=annotations)
        fig.update_layout({
        'plot_bgcolor': 'white',
        'paper_bgcolor': 'white',
        })
        fig.update_yaxes(showgrid=True, gridwidth=0.5, gridcolor='gray')
        # fig.show()
        # Convert team name into suitable use for filename
        file_team_name = '_'.join(team_name.lower().split()[:-1])
        plotly.offline.plot(fig, filename=f'./templates/graphs/{file_team_name}/fixtures_{file_team_name}.html', auto_open=False)