# pranavdivichenchu.github.io

Personal website for Pranav Divichenchu. Live at https://pranavdivichenchu.github.io

Plain HTML, CSS, and JavaScript with no build step, hosted on GitHub Pages. GSAP (ScrollTrigger, SplitText, DrawSVG) and Lenis load from jsDelivr.

- `index.html` has all the content: the scroll scenes at the top, then experience, projects, and contact
- `styles.css` has the layout and type
- `world.js` draws the background on a canvas: Blue Ridge ridgelines, mist, stars, the constellation graph, and the circular lens
- `main.js` turns scroll position into scene progress (letters drifting in, the lens, day to night to dawn), plus the nav highlighting and the phone menu
- `motion.js` runs Lenis smooth scrolling and the GSAP layer: heading reveals, the sideways project gallery on wide screens, illustrations drawing in, the cursor, the progress rail, and the hiding nav. The site still works if it fails to load
- `jwks.json` is the public key set for the FHIR project's SMART backend auth, so leave it at the root

## Run locally

```bash
python3 -m http.server 8123
```

Then open http://localhost:8123.

## Updating

To update the résumé, replace `Pranav_Divichenchu_Resume.pdf`. Each scroll-driven element has `data-in="start,end"` and `data-out="start,end"`, which are fractions of its scene's scroll progress. After changing CSS or JS, bump the `?v=` number on the three asset links in `index.html` so returning visitors don't get a cached copy.
