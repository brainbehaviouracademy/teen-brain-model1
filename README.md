# The Teen Brain — Rational vs. Emotional

An interactive 3D teaching tool that shows how the **Rational Brain (Prefrontal Cortex)**
and the **Emotional Brain (Limbic System)** interact during adolescence. Built for
workshops and one-to-one coaching sessions at **Brain Behaviour Academy**.

Drag to rotate the glowing brain, zoom in, tap the structures to read what they do,
watch signals fire across the neural network, and play the **Teen Brain Scenario** to
see why teenage emotions often react faster than reasoning.

> Created by **Sridhar Pallia** — Adolescent Psychologist & Founder, Brain Behaviour Academy.

## Features

- Procedurally generated, semi-transparent 3D brain with a glowing neuron network
- Clickable **Prefrontal Cortex** region with its four sub-areas (DLPFC, VMPFC, OFC, ACC)
- Clickable **Limbic** structures: amygdala, hippocampus, hypothalamus, nucleus accumbens, VTA, insula
- Animated neural pathways with two-way particle flow between thinking and feeling
- **Teen Brain Scenario** — a staged "emotion fires first, reasoning catches up" animation
- Side-by-side comparison dashboard and an interactive brain-development timeline
- Toggles for auto-rotate, labels, neural pathways, neurons, and an explode view
- Responsive design for desktop and tablet, with reduced-motion support

## Run it locally

It's a plain static site — no build step. Easiest options:

**Open directly:** double-click `index.html`. (Needs an internet connection the first time
so it can load the Three.js library from a CDN.)

**Or serve it** (avoids any browser file restrictions):

```bash
# Python 3
python -m http.server 8000
# then visit http://localhost:8000
```

## Publish on GitHub Pages

1. Create a new repository and push these files to the `main` branch.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*,
   choose **main** and the **/ (root)** folder, then **Save**.
4. After a minute your site is live at `https://<your-username>.github.io/<repo-name>/`.

```bash
git init
git add .
git commit -m "Add The Teen Brain interactive tool"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

## Project structure

```
.
├── index.html          # markup + element layout
├── css/
│   └── styles.css      # all styling (glassmorphism theme, responsive rules)
├── js/
│   ├── data.js         # teaching content + anatomical positions
│   └── app.js          # Three.js scene, controls, interaction, animations
├── favicon.svg
├── README.md
├── LICENSE
└── .gitignore
```

## Tech notes

- Rendering uses [Three.js](https://threejs.org/) (r128) loaded from a CDN in `index.html`.
- The brain is generated in code with noise-displaced geometry rather than a scanned
  anatomical mesh, so structures are placed for *teaching clarity*, not medical accuracy.
- To run fully offline, download `three.min.js` into the project and point the
  `<script>` tag in `index.html` at the local copy instead of the CDN URL.

## License

Code is released under the MIT License (see [`LICENSE`](LICENSE)). The educational text
and Brain Behaviour Academy branding remain the property of Sridhar Pallia.
