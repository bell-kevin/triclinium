<a name="readme-top"></a>

# triclinium

https://seatchart.org

try-KLIN-ee-um

Free, open-source seating charts for weddings, banquets, and classrooms — with an auto-seating solver. Runs entirely in your browser: no account, no server, no fees.

Named for the Roman dining room, where who sat where meant everything.

## Why

Seating-chart software is a strangely expensive niche. The market is paid desktop licenses, per-month subscriptions with tiered "editions," enterprise event-diagramming SaaS sold to venues, and free wedding-site tools whose real job is pulling you into a planning marketplace. As far as I can tell there is no serious FLOSS option in this space. triclinium is meant to be that option: the whole feature set, free forever, under a license that keeps it that way.

## Features

- **Floor plan editor** — round, banquet, and head tables plus classroom desk rows and labeled fixtures (stage, dance floor, whatever). Drag, rotate, duplicate, zoom, snap to grid.
- **Guest ledger** — add guests one at a time or paste a whole list (`Name, Group` per line). Groups get consistent colors on the chart. Pin any guest to a specific table.
- **Rules** — keep-together and keep-apart pairs. Conflicts are flagged live on the chart and in the rules panel.
- **Auto-seat** — a simulated-annealing solver assigns everyone in milliseconds. It hard-avoids keep-apart pairs at the same table, honors pins, rewards couples in adjacent seats, and gently clusters groups. Manual placement always wins: click a guest, click a seat.
- **Print center** — four print-ready documents: the floor chart, per-table lists in seat order, an alphabetical "find your seat" directory, and cut-out place cards. Print to PDF from the browser.
- **Share by link** — the entire plan is deflate-compressed (native `CompressionStream`) into the URL fragment. No backend, no upload; the recipient gets their own editable copy.
- **Local-first** — autosaves to `localStorage`, JSON export/import for backups. The app makes zero network requests and has zero analytics.

## Stack

Vite + React + TypeScript. No runtime dependencies beyond React itself — the solver, geometry, compression, and persistence are all plain browser APIs.

## Develop

```
npm install
npm run dev      # local dev server
npm run build    # type-check + production build to dist/
```

## Deploy

The build is a fully static site.

- **Bolt.new** — import this repository, then publish.
- **Netlify** — build command `npm run build`, publish directory `dist` (or just drag `dist/` into the drop zone).

## License

AGPL-3.0-only — see [LICENSE](LICENSE).

If you run a modified copy of triclinium for other people over a network, the AGPL requires you to offer them your modified source. That is deliberate: it keeps every hosted fork as free as this one.


--------------------------------------------------------------------------------------------------------------------------
== We're Using GitHub Under Protest ==

This project is currently hosted on GitHub.  This is not ideal; GitHub is a
proprietary, trade-secret system that is not Free and Open Souce Software
(FOSS).  We are deeply concerned about using a proprietary system like GitHub
to develop our FOSS project. I have a [website](https://bellKevin.me) where the
project contributors are actively discussing how we can move away from GitHub
in the long term.  We urge you to read about the [Give up GitHub](https://GiveUpGitHub.org) campaign 
from [the Software Freedom Conservancy](https://sfconservancy.org) to understand some of the reasons why GitHub is not 
a good place to host FOSS projects.

If you are a contributor who personally has already quit using GitHub, please
email me at **kevinBell@Linux.com** for how to send us contributions without
using GitHub directly.

Any use of this project's code by GitHub Copilot, past or present, is done
without our permission.  We do not consent to GitHub's use of this project's
code in Copilot.

![Logo of the GiveUpGitHub campaign](https://sfconservancy.org/img/GiveUpGitHub.png)

<p align="right"><a href="#readme-top">back to top</a></p>
