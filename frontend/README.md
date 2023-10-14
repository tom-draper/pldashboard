# Frontend

A website that requests data from the backend API and renders the data in a dashboard. Interactive visualisations are created using <a href="https://plotly.com/javascript/">Plotly.js</a>.

Currently hosted at: https://www.pldashboard.com/

This web application is currently built with Svelte and uses SSR (server-side rendering) using <a href="https://github.com/EmilTholin/svelte-routing">svelte-routing</a>, with future plans to migrate to SvelteKit.

## Development Server

```bash
npm run dev
```

## Production Server

Once built with `npm run build`, you can run the production server.

```bash
node server.js
```

## Hosting

This website is currently hosted with Vercel at https://www.pldashboard.com/ and requires the following Vercel configuration in order to run.

`/frontend/vercel.json`

```json
{
  "version": 2,
  "name": "pldashboard",
  "builds": [
    {
      "src": "./server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ]
}
```
