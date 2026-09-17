# Front-facing portraits and aquarium play

User scope: adjust friend-5/6 crops, place a single curved portrait on the fish's +X head, and add glass taps, pointer following and held bubble play. Preserve the user's six residents and names, no browser persistence or resident editor; feeding remains available.

- [x] Inspect new images and adjust only friend-5/6 crops. Change the body shader to a single head-centered angular mapping, with an opaque body and feathered photo boundary.
- [x] Add `TankPlay` in `js/tank-play.js` to own pointer gestures, bounded 3D targets, ripple/bubble effects and temporary steering intents. `Aquarium.update(dt)` advances play and uses `getIntent(fish)` before ordinary wandering; food takes priority over curiosity, fright briefly overrides food.
- [x] Play mode: mouse hover/touch drag follow, short release taps, stationary hold >=450ms emits bubbles. View mode restores OrbitControls rotation. Pinch, pointer cancellation, outside release, hidden tabs and pause clear pending gestures. Bound particles and dispose expired effects.
- [x] Add accessible mode controls, gesture hints and keyboard T/B shortcuts. Keep F feeding. Explicit taps/holds resume swimming; hover alone respects pause/reduced motion.
- [x] Verify front/back GPU pixels, tap flee/recovery, follow direction, bubble limits/cleanup and browser mouse/touch gesture cancellation. Run existing storage-free/feeding/mobile regressions, inspect face/crop renders, review changes. Deploy both branches after verification.
