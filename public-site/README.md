# Black Clover Logistics — Public Website

A standalone, public-facing marketing site for Black Clover Logistics. Built as a static
site (HTML / CSS / vanilla JS) so it can be deployed anywhere — Netlify, Vercel, GitHub
Pages, S3 + CloudFront, or even dropped into a folder behind nginx.

This site is intentionally separate from the private business OS in `/frontend` and
`/backend`. It does **not** depend on the carrier database, login system, or anything
else internal.

---

## Quick preview

From the repo root:

```bash
cd public-site
python3 -m http.server 8080
# then open http://localhost:8080
```

Or with Node:

```bash
cd public-site
npx serve .
```

---

## Hero background video — IMPORTANT

The hero (top of the page) is wired to play a short, looping background video of trucks
on the highway. **You need to drop your video file into `public-site/assets/`.**

### Required files

Place these in `public-site/assets/`:

| File | Purpose | Notes |
|------|---------|-------|
| `trucks-highway.mp4` | Main video source | Required. H.264 in MP4 container. |
| `trucks-highway.webm` | Optional smaller-size alt | Optional. WebM/VP9 — better compression. |
| `hero-poster.jpg` | Static fallback image | Shown while the video loads (and on slow connections). |

### Video specs (recommended)

- **Length:** 8–15 seconds (it loops, so seamless start/end is best)
- **Resolution:** 1920×1080 (1080p) is plenty — 4K is overkill for a background loop
- **Bitrate:** Aim for **2–4 Mbps** to keep the file under ~5 MB. Background video
  doesn't need to be visually pristine — viewers see it through a dark overlay.
- **Audio:** Strip it. The video is muted and audio just bloats the file.
- **Format:** MP4 (H.264) for universal support. Add a WebM (VP9) for ~30% smaller
  files on Chrome / Firefox / Edge.

### Where to get a clip

If you don't have your own footage, these sites have free, royalty-free, commercial-use
videos of trucks on highways:

- **Pexels Videos** — `pexels.com/search/videos/trucks/`
- **Pixabay** — `pixabay.com/videos/search/trucks/`
- **Coverr** — `coverr.co`
- **Mixkit** — `mixkit.co/free-stock-video/`

Search terms that work well: `truck highway aerial`, `semi truck driving`, `trucks
freeway timelapse`, `trucking aerial`.

### Optimizing the file

Use ffmpeg (free) to compress and strip audio:

```bash
ffmpeg -i input.mp4 -c:v libx264 -crf 28 -preset slow -vf "scale=1920:-2" -an \
  -movflags +faststart trucks-highway.mp4
```

For a WebM version:

```bash
ffmpeg -i input.mp4 -c:v libvpx-vp9 -crf 35 -b:v 0 -vf "scale=1920:-2" -an \
  trucks-highway.webm
```

For the poster image (a single frame from the video):

```bash
ffmpeg -i trucks-highway.mp4 -ss 00:00:02 -vframes 1 -q:v 2 hero-poster.jpg
```

### What happens if the video isn't there?

The site degrades gracefully:
1. The poster image (if present) shows as a static background.
2. If neither video nor poster is present, the hero falls back to a dark green
   gradient. The page still looks polished.

---

## Customizing content

Everything is in three files:

- `index.html` — copy, sections, contact info
- `styles.css` — colors, type, spacing
- `script.js` — form handling and small interactions

### Common edits

**Change the phone / email:**
Search `index.html` for `(800) 555-0199` and `dispatch@blackcloverlogistics.com` and
replace.

**Change the brand colors:**
Edit the CSS variables at the top of `styles.css`:

```css
:root {
  --accent: #1f7a3a;        /* primary green */
  --accent-bright: #2bbf5e; /* hover / highlight */
  --gold: #c9a14a;          /* secondary accent */
}
```

**Wire the quote form to a real endpoint:**
Open `script.js`. The form currently uses a `mailto:` fallback. Replace the
`window.location.href = ...` block with a `fetch()` call to your backend, Formspree,
Netlify Forms, etc.

---

## Deployment

### Netlify / Vercel

Just drag-and-drop the `public-site/` folder, or point at this repo with the publish
directory set to `public-site`.

### GitHub Pages

```bash
# from the repo root
git subtree push --prefix public-site origin gh-pages
```

### Any nginx / Apache server

Copy the contents of `public-site/` to your web root. No build step required.

---

## File structure

```
public-site/
├── index.html      # The whole site (single page)
├── styles.css      # All styling
├── script.js       # Nav toggle + form handler
├── README.md       # This file
└── assets/
    ├── trucks-highway.mp4   # ← you provide this
    ├── trucks-highway.webm  # ← optional
    └── hero-poster.jpg      # ← you provide this
```
