# Before & After Image Comparison

A browser-only image editor for creating before/after comparison images. Upload two photos, add arrows, adjust filters, reposition labels, change the layout, then download or share the result.

## Features

- Upload by click, keyboard, or drag and drop
- Separate before/after images with horizontal and vertical layouts
- Per-image brightness, contrast, and saturation controls
- Accessible arrow colour and size controls
- Draggable before/after labels
- JPEG download and native file sharing when supported
- Image validation (image files up to 20 MB)
- Offline app shell after the first online visit

## Run locally

```bash
npm ci
npm run dev
```

Open the local URL shown by Vite.

## Production build

```bash
npm run build
npm run preview
```

## Notes

- Export is capped at 16 megapixels and 8192 pixels on either side to prevent browser-memory failures with very large photos.
- The app does not upload images to a server; edits happen locally in the browser.
- Native sharing depends on browser and device support. Download remains available everywhere.
