# GeoGuard Frontend - Version 2.0 - Run & Testing Guide

## Quick Navigation

- [Overview](#overview)
- [What's New in v2](#whats-new-in-v2)
- [Frontend Improvements Log](#frontend-improvements-log)
- [How to Run the Project](#how-to-run-the-project)
- [Testing the Frontend](#testing-the-frontend)
- [Troubleshooting](#troubleshooting)

---

## Overview

This is GeoGuard's **second version** of the frontend, built on feedback from the first version. This iteration focuses on:
- **Enhanced Visual Design**: More colors, better visual hierarchy
- **Improved Usability**: Larger text, centered controls
- **Professional Polish**: Loading animation on startup
- **Better UX**: Consistent color scheme across all components

---

## What's New in v2

### 1. **Enhanced Color Scheme** 🎨
- **Blue** - Used for primary buttons and interactive elements (Live/Last 5 buttons)
- **Amber** - Used for Risk Summary cards
- **Green** - Used for Latest 5 events cards
- **Gradient backgrounds** - Cards now have subtle gradient backgrounds (from color to white)
- **Better contrast** - All colors maintain WCAG AAA accessibility compliance

### 2. **Larger Typography** 📝
- **GeoGuard Title**: Increased from `text-xl` to `text-5xl` (~2x larger)
  - More prominent branding
  - Better visibility on larger screens
  - Proper spacing maintained

### 3. **Bigger Logo** 🏢
- **Logo container**: Increased from `size-24` (96px) to `size-48` (192px)
  - Now 2x larger as requested
  - Professional appearance
  - Better visual presence in the sidebar

### 4. **Fixed Capitalization** ✅
- Changed **"Live event"** → **"Live Event"**
- Changed **"Selected event"** → **"Selected Event"**
- Proper title case throughout

### 5. **Centered Controls** 🎯
- **Live, Last 5, Refresh buttons** now centered using `justify-center`
- Better visual balance in the control section
- No more left-aligned skew

### 6. **Loading Animation** ⚡
- **Professional splash screen** that displays for ~2.5 seconds
- Features:
  - Animated rotating circle with border effect
  - Gradient background (blue to emerald)
  - Animated "INITIALIZING SYSTEM" text
  - Bouncing loading dots
  - Smooth fade-out transition
  - Gives the app a polished, professional feel

### 7. **Improved Button Styling** 🔘
- **Primary button** (Generate Response Plan):
  - Changed to blue with better contrast
  - Larger, more prominent
  - Clearer hover states
- **Live/Last 5 buttons**:
  - Blue background when active
  - Light blue hover effect when inactive
  - Better visual feedback
- **Refresh button**:
  - Blue color with light blue hover
  - Consistent with other controls

### 8. **Card Color Scheme** 🎴
- **Event Details Card**: Blue border and gradient background
- **Risk Summary Card**: Amber border and gradient background
- **Latest 5 Card**: Green border and gradient background
- All cards maintain white backgrounds for important content
- Better visual separation and hierarchy

---

## Frontend Improvements Log

### Version 2.0 Changes

| # | Component | Change | Type |
|---|-----------|--------|------|
| 1 | Logo Box | Increased from 96px to 192px | Size Enhancement |
| 2 | GeoGuard Title | Increased from text-xl to text-5xl | Typography |
| 3 | View Mode Buttons | Added justify-center for centering | Layout |
| 4 | Live/Last 5 Buttons | Changed to blue theme with gradients | Color/Style |
| 5 | Refresh Button | Added blue hover state | Color/Style |
| 6 | Event Details Card | Added blue border + gradient bg | Color/Style |
| 7 | Risk Summary Card | Added amber border + gradient bg | Color/Style |
| 8 | Latest 5 Card | Added green border + gradient bg | Color/Style |
| 9 | Text "Live event" | Capitalized to "Live Event" | Content |
| 10 | Text "Selected event" | Capitalized to "Selected Event" | Content |
| 11 | Generate Plan Button | Enhanced blue styling | Color/Style |
| 12 | Loading Screen | New LoadingScreen component | New Feature |
| 13 | App Initialization | Shows loading animation on startup | UX |

### Color Palette Used

```
Primary Blue:     #0066cc → #2563eb (active), #3b82f6 (hover)
Amber:             #f59e0b (risk/caution)
Green:             #10b981 (safe/info)
Text (Blue):       #1e3a8a
Background:        #ffffff (white primary), #f0f9ff (blue-50), #fffbeb (amber-50), #f0fdf4 (green-50)
```

---

## How to Run the Project

### Prerequisites
- **Node.js**: v18+ (check with `node --version`)
- **Python**: 3.11+ (check with `python --version`)
- **npm**: v9+ (check with `npm --version`)
- **.env.local**: Already created with `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`

### Complete Setup Steps

#### **Step 1: Install Frontend Dependencies** (if not already done)

```bash
cd c:\Users\AK\Documents\GitHub\GeoGuard
npm install
```

Expected output: Should see packages being installed, ending with "added X packages"

#### **Step 2: Start the Backend** (in Terminal 1)

```bash
cd backend
# Activate virtual environment (if not already active)
venv\Scripts\activate  # Windows

# Start backend
uvicorn app.main:app --reload
```

**Expected output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

**Access:**
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Swagger UI: http://localhost:8000/redoc

#### **Step 3: Start the Frontend** (in Terminal 2)

```bash
cd c:\Users\AK\Documents\GitHub\GeoGuard
npm run dev
```

**Expected output:**
```
> next dev

  ▲ Next.js 16.x.x
  - Local:        http://localhost:3000
  - Environments: .env.local

✓ Ready in 1.5s
```

#### **Step 4: Open in Browser**

Go to: **http://localhost:3000**

**You should see:**
1. **Loading screen** (blue to emerald gradient) for ~2.5 seconds
   - Animated circle
   - "GeoGuard" text
   - "INITIALIZING SYSTEM" message
   - Bouncing dots

2. **Main application** after loading screen
   - **Left side**: Map with earthquake visualization
   - **Right side**: Sidebar with:
     - Large GeoGuard logo
     - Large "GeoGuard" title
     - Centered Blue/Last 5/Refresh buttons
     - Event details (blue card)
     - Risk Summary (amber card)
     - Latest 5 (green card)
     - Generate Response Plan button

---

## Testing the Frontend

### Visual Tests

#### Desktop (1280px+)

- [ ] **Loading Screen**
  - Appears for ~2.5 seconds on first load
  - Shows animated circle, text, and dots
  - Smoothly fades out
  - App appears after animation

- [ ] **Layout**
  - Map on left (70% width)
  - Sidebar on right (30% width)
  - Logo box at top of sidebar (192px - 2x larger)
  - GeoGuard title is large and prominent
  - No layout shifts or jumping

- [ ] **Colors**
  - Blue buttons (Live, Last 5, Refresh)
  - Blue card border on Event Details
  - Amber card border on Risk Summary
  - Green card border on Latest 5
  - Gradient backgrounds visible on cards

- [ ] **Text**
  - "Live Event" appears (capitalized)
  - "Selected Event" appears (capitalized when switching)
  - Large title text is readable

- [ ] **Buttons**
  - Live button is blue (active)
  - Buttons centered in their container
  - Refresh button is blue with hover effect
  - Generate Response Plan button is prominent blue

#### Mobile/Tablet (< 1280px)

- [ ] **Responsive Layout**
  - Map shows on top (40vh height)
  - Sidebar scrolls below map
  - Logo still 192px (may look larger on small screens)
  - Title text responsive

- [ ] **Touch Targets**
  - All buttons ≥ 44px (accessible)
  - Buttons easy to tap
  - No overlapping elements

- [ ] **Colors**
  - All colors visible on smaller screens
  - Gradient backgrounds show properly
  - No color bleeding or distortion

### Functional Tests

#### Backend Integration

- [ ] **Backend Running**
  - Terminal shows "Uvicorn running on http://127.0.0.1:8000"
  - API Docs accessible at http://localhost:8000/docs

- [ ] **API Connection**
  - Sidebar loads earthquake data
  - "Offline mode" badge NOT shown (unless backend fails)
  - Map shows earthquake marker

- [ ] **Plan Generation**
  - Click "Generate Response Plan" button
  - Plan generates (takes 1-3 seconds)
  - Risk zones appear on map in colors
  - Sidebar shows risk summary

#### Accessibility

- [ ] **Keyboard Navigation**
  - Press Tab to move through buttons
  - Enter/Space to activate buttons
  - All controls reachable without mouse

- [ ] **Screen Reader**
  - Open DevTools (F12)
  - Use screen reader mode
  - All text is readable
  - Buttons announced properly

- [ ] **Color Contrast**
  - Blue text on white background
  - Amber text on light background
  - Green text on light background
  - All meet WCAG AAA standards

### Performance Tests

- [ ] **Loading Speed**
  - App loads in < 2 seconds
  - Map renders smoothly
  - No console errors (F12)

- [ ] **Memory Usage**
  - App doesn't lag or crash
  - Smooth interactions
  - No memory leaks

- [ ] **Responsiveness**
  - Buttons click instantly
  - Map pans/zooms smoothly
  - No stuttering or frozen UI

---

## Terminal Commands Cheat Sheet

```bash
# Navigate to project
cd c:\Users\AK\Documents\GitHub\GeoGuard

# Install dependencies
npm install

# Start frontend dev server
npm run dev

# Build for production
npm run build

# Start production build
npm start

# Check for errors/linting
npm run lint

# Navigate to backend
cd backend

# Activate Python virtual environment
venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Start backend server
uvicorn app.main:app --reload
```

---

## Troubleshooting

### Issue: Loading screen doesn't appear or appear for too long

**Solution:**
1. Clear browser cache (Ctrl+Shift+Delete)
2. Restart frontend server: `npm run dev`
3. Check that LoadingScreen component is imported in `app/page.tsx`

### Issue: Colors not showing

**Solution:**
1. Clear Next.js cache: `rm -rf .next`
2. Rebuild: `npm run build`
3. Restart dev server: `npm run dev`

### Issue: Logo image not appearing

**Solution:**
1. Check that `/public/logo.png` exists
2. Image file should be at least 192x192 pixels
3. Restart dev server

### Issue: Buttons not centered

**Solution:**
1. Check that `justify-center` class is applied to button container
2. Clear cache and rebuild
3. Check browser DevTools (F12) → Inspect element to verify classes

### Issue: Backend connection fails / offline mode

**Solution 1:** Start backend server
```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload
```

**Solution 2:** Check `.env.local`
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

**Solution 3:** Restart both frontend and backend

### Issue: Port already in use

**Backend (port 8000):**
```bash
cd backend
uvicorn app.main:app --reload --port 8001
# Update .env.local to: NEXT_PUBLIC_API_BASE_URL=http://localhost:8001
```

**Frontend (port 3000):**
```bash
npm run dev -- -p 3001
# Access at http://localhost:3001
```

### Issue: Changes not reflecting after edit

**Solution:**
1. Check that file was saved
2. Check that dev server is still running
3. Full page refresh (Ctrl+F5)
4. If still not working:
   ```bash
   # Stop dev server (Ctrl+C)
   npm run dev
   ```

---

## File Structure Reference

```
GeoGuard/
├── app/
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Main page (now with LoadingScreen)
├── components/
│   ├── QuakeSidebar.tsx     # Sidebar (UPDATED - colors, sizing)
│   ├── LoadingScreen.tsx    # NEW - Loading animation
│   ├── MapView.tsx          # Map visualization
│   ├── PlanPanel.tsx        # Response plan display
│   └── ui/                  # shadcn components
├── lib/
│   ├── api.ts               # API calls
│   ├── types.ts             # TypeScript definitions
│   └── mockData.ts          # Demo data
├── public/
│   └── logo.png             # Brand logo
└── .env.local               # Environment variables
```

---

## Next Steps

### Before Deployment
- [ ] Test on real mobile devices
- [ ] Test on different browsers (Chrome, Firefox, Safari)
- [ ] Get team feedback on new colors and design
- [ ] Performance test with production build

### Feature Ideas from v2
- [ ] Add more loading screen animations
- [ ] Theme switcher (light/dark mode)
- [ ] Customize button colors in settings
- [ ] Export report functionality
- [ ] Multi-language support

### Integration Opportunities
- [ ] PatriotAI for damage detection
- [ ] Solana blockchain for donations
- [ ] MongoDB for data persistence
- [ ] Gemini API enhancements
- [ ] ElevenLabs voice improvements

---

## Team Notes

### Version 2.0 Focus
This version prioritizes **visual polish** and **professional appearance**:
- Color scheme implemented consistently
- Typography hierarchy improved
- Loading animation adds professional touch
- Better visual feedback on all interactive elements

### Feedback Welcome
If there are suggestions for v2.1:
- Submit issues with screenshots
- Suggest color adjustments
- Request additional animations
- Propose layout improvements

---

## Support & Questions

### For Frontend Specific Issues:
1. Check this file first
2. Look at component files mentioned
3. Check browser console (F12) for errors
4. Try the troubleshooting section

### For Backend Issues:
- See [backend/README.md](../backend/README.md)

### For General Project Info:
- See [README.md](../README.md)

---

**Last Updated:** February 14, 2026  
**Frontend Version:** 2.0  
**Status:** Ready for testing and development  
**Team:** GeoGuard Frontend Development

---

## Quick Start Command

```bash
# Terminal 1: Backend
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload

# Terminal 2: Frontend (new terminal window)
cd c:\Users\AK\Documents\GitHub\GeoGuard
npm run dev

# Then open: http://localhost:3000
```

Enjoy testing the new version! 🎉
