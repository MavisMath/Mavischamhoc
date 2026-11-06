# MathBoard AI (Interactive EdTech Workspace & Math Agent)

> **An interactive, AI-powered digital canvas that translates natural language into structured geometric visualizations and step-by-step mathematical reasoning.**

[![React](https://img.shields.io/badge/React-18-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Google Gemini AI](https://img.shields.io/badge/Google_Gemini-2.0_%26_Flash-E37400?logo=google)](https://deepmind.google/technologies/gemini/)
[![JSXGraph](https://img.shields.io/badge/JSXGraph-2D_Dynamic_Geometry-0284c7)](https://jsxgraph.uni-bayreuth.de/)
[![Three.js](https://img.shields.io/badge/Three.js-3D_Visualizations-black?logo=three.js)](https://threejs.org/)
[![KaTeX](https://img.shields.io/badge/KaTeX-Math_Formulas-319795)](https://katex.org/)
[![Python WebSockets](https://img.shields.io/badge/WebSockets-Realtime_Sync-3776AB?logo=python)](https://websockets.readthedocs.io/)

---

## Project Overview
**MathBoard AI** is a modern, collaborative educational platform designed for secondary and high school educators, students, and researchers. It bridges the gap between natural language problem statements and dynamic mathematical models.

* **Source Code**: [https://github.com/MavisMath/Mavischamhoc](https://github.com/MavisMath/Mavischamhoc)
* **Tech Stack**: AI-Assisted Dev (Cursor/v0), React, TypeScript, JSON, Agentic Workflows, Tailwind CSS, Python (WebSockets & SQLite).

---

## Key Features & Architectural Highlights

### 1. Google Docs-style Document Management Hub
- Authentic **Google Docs Dashboard**: Search bar with real-time filtering, ownership toggles, and grid/list view switchers.
- **Template Gallery**:
  - `+ Bảng trống (Blank Padlet)` with authentic Google 4-color plus icon.
  - Plane Geometry (Circle & Tangents, Inscribed/Circumscribed).
  - Algebra & Cartesian Oxy Coordinate (Parabola & Line Intersections).
  - 3D Geometry (Regular Pyramids, Polyhedrons).
  - Exam Worksheets & Problem Sets.
- **Document Actions**: Inline renaming, duplicating, sharing via link, and SQLite-backed deletion.

### 2. Autonomous AI Math Agent & Natural Language Parsing
- **Dynamic Geometry Compiler**: Translates natural language prompts (Vietnamese/English) into strictly typed declarative JSON specifications (`GeometryStep[]`).
- **LaTeX Sanity Engine (`robustFixJson`)**: Eliminates JSON parse errors caused by raw mathematical LaTeX commands (`\widehat`, `\cdot`, `\Delta`, `\perp`, `\circ`).
- **Resilient Multi-Model Fallback**: Automatically tries active Google Gemini models (`gemini-flash-lite-latest`, `gemini-3.5-flash-lite`, `gemini-3.6-flash`, `gemini-2.0-flash`) to prevent free-tier 429 quota blockades.

### 3. Multi-Dimensional Interactive Canvas (2D & 3D)
- **Mathematical 1:1 Aspect Ratio**: Strict geometric coordinate locking (`keepaspectratio: true`) ensuring circles, tangents, and polygons are never distorted into ellipses.
- **Dynamic Element Inspector**: Click any point, segment, circle, or angle to change line style (`── Liền`, `- - Đứt`, `··· Chấm`), color palette, or delete with the trash button.
- **Interactive Whiteboard Layer**: High-precision pen, highlighter, and eraser integrated seamlessly with geometric cards.
- **3D Interactive Space**: Three.js rendering for spatial geometry (rotating regular pyramids, cubes, cylinders 360°).

### 4. Global Action History (Multi-Entity Undo / Redo)
- Unified stack tracking up to **100 past actions**:
  - Adding / deleting cards
  - Moving cards & geometric figures
  - Draping and rendering JSXGraph dynamic boards
  - Whiteboard stroke drawing & eraser deletions

### 5. Real-Time Collaboration & SQLite Auto-Save
- Dual-synchronization architecture:
  - **Local-first**: Instant 0ms load and recovery via `LocalStorage`.
  - **Cloud sync**: Python WebSockets (`ws://localhost:8765`) syncing live mouse cursors, canvas deltas, role-based controls (Host, Editor, Viewer), and auto-saving to SQLite database.

---

## Project Architecture

```
Web padlet/
├── src/
│   ├── types/                     # TypeScript Type Definitions
│   │   ├── geometry.ts            # Declarative JSXGraph steps & entities
│   │   ├── card.ts                # Math cards & visual modules
│   │   ├── padlet.ts              # Padlet document & snapshot schema
│   │   ├── collab.ts              # WebSocket messages & user roles
│   │   └── agent.ts               # AI Agent request & response schemas
│   ├── services/
│   │   └── geminiService.ts       # Gemini API, robustFixJson & compiler
│   ├── hooks/
│   │   └── useGlobalHistory.ts    # 100-step multi-action Undo/Redo hook
│   ├── components/
│   │   ├── dashboard/             # Google Docs Dashboard components
│   │   │   ├── GoogleDocsHeader.tsx
│   │   │   ├── TemplateGallery.tsx
│   │   │   └── RecentPadletsGrid.tsx
│   │   ├── canvas/                # Interactive canvas & cards
│   │   │   ├── DynamicGeometryCard.tsx
│   │   │   └── WhiteboardLayer.tsx
│   │   └── chat/                  # AI Math Agent drawer
│   │       └── MathAgentDrawer.tsx
│   ├── App.tsx                    # Root React Application
│   └── index.tsx                  # React Entry Point
├── index.html                     # Google Docs Dashboard Interface
├── padlet_ai_mathboard.html       # High-performance Workspace Canvas
├── collaborative_server.py        # Python Real-Time WebSocket Server
├── start_services.py              # Orchestration daemon for Web & WS
├── package.json                   # React + TypeScript project dependencies
├── tsconfig.json                  # TypeScript compiler settings
└── vite.config.ts                 # Vite bundler configuration
```

---

## Quick Start

### 1. Prerequisites
- Python 3.9+ (for WebSocket server & Local HTTP service)
- Node.js 18+ (optional, for React/Vite development server)

### 2. Running the Live Application (Python Daemon)
```bash
python start_services.py
```
- **Web App / Dashboard**: [http://localhost:8080](http://localhost:8080)
- **WebSocket Server**: `ws://localhost:8765`

### 3. Running with React & Vite (Frontend Dev)
```bash
npm install
npm run dev
```

---

## License
This project is licensed under the MIT License - see the LICENSE file for details.
