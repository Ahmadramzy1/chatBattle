# Visual review — Slate Glass

Reviewed locally in an isolated Chromium/Edge context at 1440px and 390px, in Persian and English. Covered setup, collection lobby, arena/bracket, results, viewer form and callback. Preview network requests to external services were blocked; no live competition or viewer identity was used.

## Sequential reviews

- Accessibility: visible keyboard focus, semantic language group, player control labels, labeled demo fields, skip link, dialog focus containment/return, reduced motion, readable ice-blue action text.
- Visual consistency: replaced the remaining legacy green bracket state, red video cover and dark timer material; retained the existing gold WebGL coin and brand logo.
- Hierarchy: one primary action per flow; secondary actions use translucent slate; compact thumbnails retained in the bracket; English/Persian alignments follow document direction.
- Interaction states: selected radio/toggle, hover, pressed, disabled, errors and connection feedback share the new palette.

## Preservation

The tournament engine block is identical to the prior deployed source. Storage keys, Firebase rules, Worker endpoints, media resolvers, chat receiver and coin renderer are unchanged. User topics and account names are excluded from UI translation. Locale uses a separate storage key.

## Limits

Screenshots used local sample state and placeholders where external thumbnails were unavailable. This pass did not repeat live Kick authentication, actual chat delivery, third-party embed playback or cloud submissions. Browser font files are local assets with OFL licenses.
