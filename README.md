# Mountain_Honey_Pine_Cabin
Interactive 3D environment built with Three.js, focusing on camera navigation, user interaction, and spatial audio. Demonstrates GLB asset loading, terrain-aware movement, object interaction, and lightweight UI overlays in a web-based 3D scene.
README (paste into your repo as README.md)
=========================================

# Pine Cabin – Interactive 3D Scene (Three.js) ###

A small interactive 3D environment built with Three.js (ES Modules).  
Focus: camera navigation ergonomics, object placement workflow, light/audio atmosphere, and a clean “walk around the scene” experience.

## What it demonstrates ##
- GLB scene loading (terrain + props) using `GLTFLoader`
- User-friendly navigation (mouse-look + keyboard movement)
- Terrain-following camera height to prevent clipping under the ground
- Positional + ambient audio (forest/wind global, bees positional)
- Lightweight UI overlay (product info popup)
- Scene state save/load (localStorage) + JSON export

## Controls ##
- Mouse: look around
- W/A/S/D: move
- Space: up (if enabled)
- Shift: down (if enabled)

> Note: some features (like object selection highlight) may be disabled for “viewer mode”.


http-server -p 5173

