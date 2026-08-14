# Geometry Scanning Generator Spec

This document is a handoff spec for another AI or developer.

## Project Goal

Build a plain HTML/CSS/JS generative instrument that scans a geometry or image source, extracts simple visual features, and maps them to sustained harmonic sound.

The current direction is not a punchy bass sequencer. It is a sustained image-driven sound system with:

- continuous harmonic beds
- image scanning and feature extraction
- live parameter control
- tab-based preset selection
- Web Audio synthesis only, no external libraries

## Current Product Name

`Geometry Scanning Generator`

The project's `bloom` branding replaces the earlier prototype naming. The note `Acid Bass` in the voice preset list below is a genre name (TB-303-style bass timbre) and is intentionally retained as a sound palette label.

## File Layout

- `index.html` - UI and canvas layout
- `styles.css` - visual styling and compact control layout
- `app.js` - audio engine, geometry generation, scanning, presets, state management
- `assets/cell2.vector.svg` - default visual source
- `assets/plant-spiral.png` - plant/cell-like autogenesis visual source

## Core Behavior

### Audio

- Uses Web Audio API only.
- Audio must be started explicitly with `Start Audio`.
- Sequencing can be started and stopped separately with `Start Sequencer` / `Stop Sequencer`.
- Audio is sustained and layered rather than percussive-first.
- There are three continuous layers:
  - `OSC1`
  - `Drone`
  - `OSC2`

### Visuals

- Canvas-based geometry display.
- Default source is `cell2.vector.svg`.
- Alternative source is user-uploaded image.
- Autogenesis mode can regenerate geometry from master audio analysis.
- Scan path is visualized on the canvas.
- A luminance strip is shown below the main canvas.

## UI Layout

The left side is intentionally compact.

### Global Actions

- `Start Audio`
- `Start Sequencer`
- `Start Autogenesis`
- `Pattern Mutation`

### Tab-Based Controls

Dropdowns were replaced with tabs for:

- `Rhythm`
- `Scale`
- `Root note`
- `Function`
- `Scan source`
- `Scan path`
- `OSC1 voice`
- `Drone voice`
- `OSC2 voice`

### Sliders

The UI currently exposes:

- `BPM`
- `Cutoff`
- `Resonance`
- `Decay`
- `Accent`
- `Slide`
- `Tone brightness`
- `Texture`
- `Master drive`
- `Air mix`
- `Edge brightness`
- `Harmonics`
- `OSC1 level`
- `OSC1 drive`
- `OSC1 spread`
- `OSC1 motion`
- `Drone level`
- `Drone drive`
- `Drone spread`
- `Drone LFO rate`
- `Drone LFO depth`
- `OSC2 level`
- `OSC2 drive`
- `OSC2 spread`
- `OSC2 motion`

## Audio Mapping

### Feature Extraction

The geometry source is reduced to three values:

- `density`
- `edgeDensity`
- `complexity`

These are used to drive:

- note selection
- accent
- slide
- cutoff

### Scale System

Scale presets are ratio-based rather than only semitone-based.

Included presets currently include:

- Japanese In
- Balinese Pelog
- Javanese Slendro
- Arabic Hijaz
- Raga Bhairav
- Andean Pentatonic
- Ethiopian Tizita
- `1/f Harmonic`
- `Golden Ratio`

### Root System

There are two root concepts:

- `Root note` tabs select the tonal center as an absolute pitch class.
- `Root degree` tabs select the layer-specific degree inside the current scale.

Layer degrees are maintained separately for:

- `OSC1`
- `Drone`
- `OSC2`

### Preset Categories

Current rhythm presets:

- Kecak Cycle
- Ewe Bell
- Maqsum Drift
- Gamelan Interlock
- Huayno Pulse

Current function presets:

- Orbit
- Cascade
- Mirror

Current scan sources:

- Autogenesis
- Cell Vector
- Uploaded Image
- Chevron Weave
- Dark Chevron
- Star Lattice
- Night Star Lattice
- Node Net
- Cubic Weave
- Brick Grid
- Black Field
- Plant Cell

Current scan paths:

- Horizontal Raster
- Vertical Raster
- Diagonal
- Spiral

Current voice palettes:

- Acid Bass
- Industrial Metal
- Sheet Metal
- Physical Noise
- Data Click
- Bit Noise
- Scan Pulse
- White Burst
- Bronze Cluster
- Gamelan Gong
- Gamelan Metallophone
- Ritual Chorus
- Bamboo Thump
- Pipe Organ
- Fender Rhodes
- Prophet
- Voice
- Kecak

## Distortion Strategy

The sound was intentionally de-tooled from heavy overdrive.

Current distortion is controlled by:

- `Master drive`
- per-layer drive sliders
- `Texture`

The important design goal is that chord changes remain readable. If the sound becomes too flattened again, lower `Master drive` first and keep the layer drives modest.

## Visual Scanning

The canvas scan path is used as a spatial source for:

- per-step brightness
- edge sampling
- pan motion
- cutoff modulation

The scan path itself is currently selectable by tabs, not a dropdown.

## Autogenesis

Autogenesis is a feedback loop:

1. Analyze master output with an analyser node.
2. Extract rough loudness / brightness / roughness values.
3. Mutate geometry seeds from those values.
4. Rebuild the geometry and audio patterns.

This is intentionally lightweight and not an ML system.

## Important Implementation Notes

- The project must remain plain HTML/CSS/JS.
- Do not introduce React, Vite, or external libraries.
- Do not add MIDI export or WAV export.
- The current visual default is the cell SVG asset.
- The current audio is continuous and sustained by design.
- The UI is tuned for a narrow, vertically stacked control column and a larger visual canvas.

## Main Files To Inspect

- `index.html` for the UI structure
- `app.js` for preset logic, audio synthesis, and scan mapping
- `styles.css` for the compact tab layout and panel sizing

## Known Direction

The current direction is:

- more sustained than percussive
- more readable than aggressively distorted
- more tab-driven than form-driven
- more image/geometry reactive than step-sequencer-only

If you continue development, keep that balance unless the user explicitly asks for a different sound.
