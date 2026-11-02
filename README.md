# pranavdivichenchu.github.io

Personal website for Pranav Divichenchu. Live at https://pranavdivichenchu.github.io

A 3D studio you can look around, built with Three.js. Fifteen stations run clockwise around the room: the jobs on the first two walls (Karana, FHIR, Cloud9, Politheon, Mizzou), the projects on the third (B2Alpha, Sprout, Nexus, Vibez, AEGIS, Khali, More), then About, the school, and the door. Clicking one flies the camera in and opens its panel. No build step: plain HTML, CSS and JavaScript modules, hosted on GitHub Pages.

- `index.html` has all the content (the twelve station panels), the HUD, the loader, and the styles. It also works as a plain page: the "List view" button, and any browser without WebGL 2 or import maps, shows the same content as one long document
- `room/main.js` is the engine: the stations and where they're placed, the camera (drag-to-look with inertia, arcing flights with quaternion turns, eased parallax), picking with one hit box per station, the floating labels (which push apart when they'd overlap), the panel, the dock, the tour, and the screens that redraw while they're in view (the phone, the laptop, the wall display, the monitor, the tablet)
- `room/shell.js` builds the room: floor, walls, ceiling, the window onto campus with its curtains, the lights (a soft key light just under the ceiling, the sun through the window, five accent spots), the door and what's outside it, the name sign, the welcome note, the pinboard and the rug
- `room/models.js` builds everything in the room from primitives: the Karana desk (laptop, phone, diya, chair), the whiteboard, the Cloud9 wall display and neon, the credenza with the Capitol and the bills, the research easel, the server rack, the trophy shelf, the workstation with the molecule, the side table and lamp, the bookcase, the school model and its plane, the globe, the clock, the door, the plant
- `room/kit.js` is the shared modeling kit: materials (with procedural wood grain, fabric, marble), geometry helpers (rounded panels, leaves, tubes), canvas textures, and the `Builder` that merges geometry per material
- `vendor/three/` is Three.js r170 (the minified module build plus the three addons the room uses), vendored so the site has no runtime dependency on a CDN
- `images/` holds the Karana icon and the screenshots used on the pinboard and in the panels
- `jwks.json` is the public key set for the FHIR project's SMART backend auth, so leave it at the root

## Run locally

```bash
python3 -m http.server 8131
```

Then open http://localhost:8131. Modules need to be served over HTTP; opening `index.html` from disk won't work.

## Updating

- To change a panel's text, edit its `<section class="sec" id="p-…">` in `index.html`. The dock button, the station entry in `room/main.js` (`STATIONS`) and the section id share the same key.
- To move the camera for a station, change its `view` (`pos` and `look`) and `fit` (the width and height, in metres, that must stay in frame) in `STATIONS`. Stations with `view: null` are aimed at their object once it's placed (see the `aim(...)` calls).
- To update the résumé, replace `Pranav_Divichenchu_Resume.pdf`.
- `?tier=low` in the URL previews the phone-level settings (smaller textures, fewer shadows).
- Shadows are drawn once (`renderer.shadowMap.autoUpdate = false`). Anything that moves (the flame, the molecule, the plane, the clock hands) is kept out of the shadow maps; the door redraws them only while it swings. The walls and ceiling live on layer 2 so they block the sun but not the key light.
- In the console, `__room.openStation('karana')`, `__room.advance(seconds)` and `__room.pickAt(x, y)` drive the room by hand.
