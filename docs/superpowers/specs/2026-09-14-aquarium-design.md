# 우리들의 아쿠아리움

HTML, CSS, ES modules and locally vendored Three.js render a responsive, interactive aquarium on GitHub Pages without a build step. Three existing JPEGs supply default fish portraits. Portraits are cropped in a browser canvas onto oval textures attached to both sides of each fish; the user can adjust crop position and zoom, change names/colors, add photos, or remove fish. Changes persist in browser localStorage with graceful handling of unavailable/full storage. Original photos remain intact.

The scene contains a glass tank, sandy seabed, rocks, swaying ribbon kelp, coral, bubbles, underwater light patterns and independently swimming fish with animated fins. OrbitControls provides bounded viewing angles. Feeding draws fish toward sinking food. Controls include speed, pause, light mode, reset view and fullscreen. Korean interface, responsive layouts, keyboard-accessible dialogs, reduced-motion support, error and loading states are required.

Design: deep teal background, mint highlights, warm sand and coral fish, restrained glass panels, a prominent live aquarium and a compact resident roster. No backend or external photo upload. Default photos included in a published repository are public; newly chosen photos remain in the browser. Three.js is pinned and vendored with its MIT license.
