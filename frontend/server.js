import { join } from 'path';
import express from 'express';
import app from './public/App.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const port = 3000;
const server = express();

server.use(express.static(join(__dirname, 'public')));

server.get('*', function (req, res) {
  const { html } = app.render({ url: req.url });

  res.write(`
    <!DOCTYPE html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="google-site-verification" content="qYIoNrgrvCixUb5A9kCDDt8jvrz7N0x64vPaEgw-Txs" />
      <meta name="keywords" content="football, premier league, dashboard, fantasy, stats, statistics, analysis"/>
      <meta name="description" content="Premier League Dashboard - A football dashboard presenting the current performance of each Premier League team."/>
      <link rel='stylesheet' href='/global.css'>
      <link rel='stylesheet' href='/bundle.css'>
      <link rel='icon' href='img/favicon.ico'> 
      <script src="https://cdn.plot.ly/plotly-latest.min.js" type="text/javascript"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.0/jquery.min.js" integrity="sha512-3gJwYpMe3QewGELv8k/BX9vcqhryRdzRMxVfq6ngyWXwo03GFEzjsUm8Q7RZcHPHksttq7/GFoxjCVUjkjvPdw==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
      <link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/jquery.dataTables.css" />
      <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.js"></script>
    </head>

    <body>
      <div id="app">${html}</div>
      <script src="/bundle.js"></script>
    </body>
  `);

  res.end();
});

server.listen(port, () => console.log(`Listening on http://localhost:${port}`));
