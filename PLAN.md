# Zero-G Task Nebula: Implementation Plan

## Overview
This project transforms a standard To-Do list into an immersive "Zero-G Task Nebula" web application. Tasks float as bubbles in a space-themed environment, featuring interactive physics and "Supernova" completion effects.

## Features
- **UI/UX**: 
  - Deep space background (`src/index.css`).
  - Floating task bubbles using `framer-motion` (`src/components/TaskBubble.jsx`).
  - "Supernova" explosion animation on task completion.
  - Responsive layout for mobile and desktop.

- **Data & Scalability**:
  - Integrated Firebase Firestore for real-time data syncing.
  - Queries optimized with `orderBy("createdAt", "desc")`.
  - Scalable architecture ready for high traffic.

- **Performance**:
  - Debounced search functionality (`lodash.debounce`).
  - Efficient React rendering and state management.

- **Deployment**:
  - Configured for GitHub Pages.
  - Added `deploy` script to `package.json`.
  - `.env.example` created for secure API key management.

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Firebase**:
   - Create a project in [Firebase Console](https://console.firebase.google.com/).
   - Enable Firestore Database.
   - Copy your web app configuration keys.
   - Rename `.env.example` to `.env` and fill in your keys.

3. **Run Locally**:
   ```bash
   npm run dev
   ```

4. **Deploy to GitHub Pages**:
   - Update `vite.config.js` `base` URL if deploying to a user page or custom domain if needed (already set to `./`).
   - Run:
     ```bash
     npm run deploy
     ```

## Code Structure
- `src/components/TaskNebula.jsx`: Main container, handles Firestore logic and Search.
- `src/components/TaskBubble.jsx`: Individual task component with floating/exploding animations.
- `src/firebase.js`: Firebase initialization.

Enjoy your Zero-G productivity experience!
