# Vendor Dependencies

These files are vendored locally for deterministic Safari extension builds.

## Current versions

- `markdown-it.min.js` -> `markdown-it@14.1.0`
- `markdown-it-task-lists.min.js` -> `markdown-it-task-lists@2.1.1`
- `purify.min.js` -> `dompurify@3.2.6`

## Source URLs

- `https://cdn.jsdelivr.net/npm/markdown-it@14.1.0/dist/markdown-it.min.js`
- `https://cdn.jsdelivr.net/npm/markdown-it-task-lists@2.1.1/dist/markdown-it-task-lists.min.js`
- `https://cdn.jsdelivr.net/npm/dompurify@3.2.6/dist/purify.min.js`

## Upgrade checklist

1. Replace the three files with pinned versions from upstream.
2. Verify `popup.html` still loads all vendor scripts before `popup.js`.
3. Validate rendering in workbench for:
   - headings/lists/tables/code fences
   - task lists (`- [ ]`, `- [x]`)
   - links and HTML sanitization behavior
4. Open `md-regression.html` and ensure all assertions show `PASS`.
5. Run manual export smoke tests for Markdown/PNG/PDF.
