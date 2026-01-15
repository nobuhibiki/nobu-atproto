# Technical Decisions Log

This document tracks all technical decisions made during development.

---

## boxsky - Firehose Box Visualization

### Architecture Decisions

**Single Page Application (SPA)**
- Reason: Simple, no backend needed, runs entirely in the browser
- Connects directly to ATProto's Jetstream service via WebSocket

**Real-time Data Source: Jetstream**
- Using `wss://jetstream2.us-east.bsky.network/subscribe` instead of raw firehose
- Reason: Jetstream provides JSON-formatted events (easier to parse in browser) vs raw firehose which uses DAG-CBOR binary encoding
- Filtered to only `app.bsky.feed.post` collection to reduce noise

### Technology Choices

**Framework: React + TypeScript**
- React for UI reactivity and state management
- TypeScript for type safety and better developer experience
- Vite as build tool for fast development

**Styling: Plain CSS**
- No CSS framework to keep bundle small
- Custom animations for the "pop in" effect on new boxes

**Key Libraries**
- `@atproto/api` - Available but not used yet (for future authenticated features)
- `cbor-x` - Available but not used (Jetstream handles JSON conversion)

### Design Decisions

**Color Assignment**
- Each author gets a unique color based on their DID (decentralized identifier)
- Uses hashing to generate consistent HSL hue per user
- Same person's posts always have the same color

**Performance Limits**
- Maximum 200 posts displayed at once (oldest removed as new arrive)
- Prevents memory issues while keeping screen populated

**Visual Style**
- Dark background (#1a1a2e) for contrast
- Rounded boxes with subtle gradient shine effect
- Bouncy "pop in" animation using cubic-bezier timing
- Hover effect scales boxes up for inspection

---

## Hosting & Infrastructure

**Current: Local Development**
- Running via Vite dev server
- No backend required - pure client-side app

**Future Deployment Options** (when ready)
- Vercel (free tier) - automatic deploys from git
- Netlify (free tier) - similar capabilities
- GitHub Pages - free, good for static sites

---

## Changelog

### 2025-01-13 - boxsky v0.1
- Created initial project structure
- Implemented Jetstream WebSocket connection
- Built box visualization with color-coded posts
- Added Nintendo-inspired UI styling
- Posts appear as colored squares with text preview
- Hover to see full post content in tooltip
