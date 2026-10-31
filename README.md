# Be-Naseeb Ishq — Next.js + Tailwind

Realistic page-turning poetry book (English/Roman Urdu and Urdu script).

## Run
```bash
npm install
npm run dev        # http://localhost:3000
# production:
npm run build && npm start
```
Node 18.17+ required.

## Structure
- `app/` — layout (Google Fonts links), page, `globals.css` (Tailwind + 3D book/page CSS)
- `components/Book.tsx` — the whole book: page-flip engine, controls (Tailwind), contents panel, language switch
- `data/book.en.json`, `data/book.ur.json` — manuscript pages (HTML strings), contents, titles
- `public/cover.jpg` — front cover cropped from your artwork
- `tools/` — Python generator (`build.py`, `tpl.html`, `ur.txt`) that rebuilds the JSON from your PDF

## Changing text
- Urdu: edit `tools/ur.txt`.
- Roman Urdu: comes from your manuscript PDF.

To regenerate the JSON, open `tools/build.py` and change the paths at the top (`U=...` folder holding your PDF and cover PNG, and the PDF/PNG file names) and the last line of the main script that writes the standalone HTML. Then:
```bash
pip install pypdf pillow
cd tools && EXPORT=.. python build.py     # writes ../data/*.json and ../public/cover.jpg
```
