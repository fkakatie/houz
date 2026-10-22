# Houz

Houz is an extremely personal house-evaluation app. It helps me record what I observe about houses I'm considering, see how well each one fits my bizarre rubric, and what it would realistically cost.

It is decidedly NOT a general real-estate product. The criteria, weights, and financing assumptions reflect my own priorities and they're hard-coded on purpose. You're welcome to read it, fork it, or adapt the scoring to your own life (or, more likely, make your favorite agent do it).

## What it does

- **Houses** lists every house you've added, with its listing price, status, and Overall Fit score. Fit is a weighted score built from concrete observations and it stays hidden until at least half of the scored information is known. 
  - **Map** is the other way to view Houses: it plots each house you've given a latitude and longitude on a map of the Salt Lake area. Tap a house to see a short summary of it.
  - **Compare** is an action on this view: tick two houses to see them side by side, line by line. 
- **Add House** creates a house from an address, its [UtahRealEstate.com](https://utahrealestate.com/index/public.index) MLS number, a listing price, and a listing date. The MLS number is the house's id and House Detail uses it to link back to the listing. You then fill in the rest over time, like during research or on a tour.
- **Price Ladder** orders houses by listing price and explains each step up: what the next house gains and gives up for the extra money.
- **Settings** holds the financing assumptions (rate, points, fees) and the cost targets the scores are measured against. Its **Map** card keeps a few places that matter to you, each a title with a latitude and longitude, which show on the Houses map as reference points. Tap one to see its title.

## Running it

There's no build step and there are no runtime dependencies. It's plain HTML, CSS, and JavaScript modules.

Serve the folder with any static server and open it in a browser:

```sh
npx serve .
```

⚠️ Opening `index.html` directly from disk won't work because browsers don't load JavaScript modules from `file://`.

It needs a current browser: Chrome or Edge, Safari 17.2+, or Firefox 138+. Houz relies on JSON module imports, popovers, `<dialog>`, and CSS `:has()`. An ancient browser will show a blank page.

## Your data

Everything you enter is saved in your browser's `localStorage` on your device only. There's no backend, no account, and nothing is sent anywhere. The only network requests are for house photos, loaded from the image URLs you enter. Latitude and longitude are typed in by hand. Houz never looks up an address. The listing link on House Detail is an ordinary link: nothing is fetched from an external real estate site.

To move data between browsers or keep a copy, use **Export backup** and **Import backup** in Settings. A backup contains all your houses and settings, so keep it out of the repository (`.gitignore` already excludes `houz-backup-*.json`).

## Development

Requires Node.js 20.19+.

```sh
npm install
npm test       # node:test unit tests for data, calculations, scoring, routing, and view labels
npm run lint   # ESLint and Stylelint
```

The code is in `scripts/`:

- `data.js`: data model, validation, and storage
- `calculations.js`: financing and derived facts
- `scoring.js`: scores, Compare, and Price Ladder logic
- `render.js`: read-only views
- `forms.js`: editing views
- `app.js`: routing

The styles are in `styles/`. `index.html` loads only `styles.css`: the tokens, the shell, and everything most views share. The rest are loaded the first time they're needed and then kept: `houses.css`, `map.css` (when Houses first shows the map), `forms.css` (Settings, Add and Edit House, and House Detail's dialogs), `house-detail.css`, `compare.css`, `ladder.css`, and `settings.css`. Those files can arrive in any order, so none of them may depend on another loading first.

The Houses map is `map/map.svg`, a cropped vector map, together with `map/map.json`. The JSON file holds the map's extent, the Web Mercator constants that place a latitude and longitude on it, and the attribution.

Map data © OpenStreetMap contributors, available under the [Open Database License](https://www.openstreetmap.org/copyright).

## License

[MIT](LICENSE)
