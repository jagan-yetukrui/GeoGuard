# GeoGuard - How to Run & Test the Frontend

## Quick Start (5 minutes)

### Prerequisites
- **Node.js**: v18+ (check with `node --version`)
- **Python**: 3.11+ (for backend)
- **npm**: v9+ (check with `npm --version`)

---

## Step 1: Install Frontend Dependencies

```bash
# From the project root directory
npm install
```

This installs all required packages:
- Next.js 16
- React 19
- Tailwind CSS 4
- Leaflet (mapping)
- Lucide icons
- Framer Motion (animations)
- shadcn/ui components

---

## Step 2: Set Up Backend (in a separate terminal)

```bash
# Navigate to backend folder
cd backend

# Create Python virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate

# On macOS/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Start the FastAPI backend
uvicorn app.main:app --reload
```

Backend should now run at: **http://localhost:8000**

You can view API docs at: **http://localhost:8000/docs**

---

## Step 3: Configure Environment Variables

Create a `.env.local` file in the project root:

```env
# Backend API endpoint
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# Optional: For Gemini AI features
# GEMINI_API_KEY=your_key_here

# Optional: For ElevenLabs voice features
# ELEVENLABS_API_KEY=your_key_here
```

---

## Step 4: Start the Frontend Development Server

```bash
# From the project root (in a new terminal)
npm run dev
```

Frontend will run at: **http://localhost:3000**

---

## Access the Application

1. Open **http://localhost:3000** in your browser
2. You should see:
   - Interactive map (left 70%)
   - Control sidebar (right 30%)
   - Earthquake event details
   - Options to generate response plans

---

## Testing the Frontend

### Desktop Testing (Recommended)
```bash
# Keep everything running, just refresh browser
http://localhost:3000
```

### Mobile/Responsive Testing

**Using DevTools:**
1. Open browser DevTools (F12)
2. Click "Toggle device toolbar" (Ctrl+Shift+M)
3. Select different devices to test responsiveness

**Manual responsive sizes to test:**
- Mobile: 375px width
- Tablet: 768px width
- Desktop: 1024px+ width

### Feature Testing Checklist

#### Map Display
- [ ] Map loads with mock earthquake data
- [ ] Risk zones display in colors (red, orange, green)
- [ ] Earthquake marker pulses at center
- [ ] Station markers show when plan is generated

#### Sidebar Controls
- [ ] "Live" button shows current earthquake
- [ ] "Last 5" button shows recent earthquakes
- [ ] Magnitude, location, depth displayed
- [ ] Risk Summary shows zones

#### Plan Generation
- [ ] Click "Generate Response Plan" button
- [ ] Wait for plan to generate (should be fast)
- [ ] "Play Briefing" button becomes active
- [ ] "Verify" button becomes active
- [ ] "Save" button becomes active

#### Color/Accessibility
- [ ] High risk zones appear RED
- [ ] Medium risk zones appear AMBER/ORANGE
- [ ] Low risk zones appear GREEN
- [ ] All text is readable (high contrast)
- [ ] Links/buttons have visible hover states

#### Keyboard Navigation (Accessibility)
1. Open browser DevTools: F12
2. Go to Console tab
3. Test by TAB-ing through interface:
   - Tab moves through buttons
   - Enter/Space activates buttons
   - All controls reachable without mouse

---

## Frontend Development Workflow

### 1. Editing Components

After making changes, the site auto-reloads:

```
Edit file → Save → Browser auto-updates
```

**Key files to edit:**
- `app/globals.css` - Colors, fonts, styling
- `components/QuakeSidebar.tsx` - Main control panel
- `components/MapView.tsx` - Map visualization
- `components/PlanPanel.tsx` - Response plan display
- `app/page.tsx` - Main layout

### 2. Testing Style Changes

```bash
# Option 1: Hot reload (automatic)
# Just save the file and watch browser update

# Option 2: Manual rebuild
npm run build

# Then restart dev server
npm run dev
```

### 3. Checking for Errors

```bash
# Check TypeScript compilation
npm run build

# Check ESLint (code style)
npm run lint
```

---

## Troubleshooting

### Issue: "Cannot GET /" or blank page

**Solution:** Make sure dev server is running
```bash
npm run dev
# Should say "ready - started server on 0.0.0.0:3000"
```

### Issue: Backend connection fails / Offline mode

**Solution 1:** Start backend server
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Solution 2:** Check `.env.local`
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

**Solution 3:** App still works in offline mode with mock data (no error)

### Issue: Map not displaying

**Cause:** Leaflet CSS not loaded

**Solution:**
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
npm install

# Restart dev server
npm run dev
```

### Issue: Styles not updating

**Solution:**
```bash
# Clear build cache
rm -rf .next

# Rebuild
npm run build

# Restart dev server
npm run dev
```

### Issue: Port 3000 already in use

**Solution:**
```bash
# Use different port
npm run dev -- -p 3001
# Then access at http://localhost:3001
```

### Issue: Port 8000 already in use (backend)

**Solution:**
```bash
cd backend

# Use different port
uvicorn app.main:app --reload --port 8001

# Update .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8001
```

---

## Building for Production

### Frontend Build

```bash
# Create optimized production build
npm run build

# Test production build locally
npm run start
# Access at http://localhost:3000
```

### Deploy to Vercel (Recommended)

```bash
# Push to GitHub first
git add .
git commit -m "Frontend updates"
git push origin main

# Then deploy from Vercel dashboard
# https://vercel.com/new
```

### Deploy Backend to DigitalOcean

See [backend README](backend/README.md) for Docker deployment instructions.

---

## Project Structure

```
GeoGuard/
├── app/
│   ├── globals.css          ← Global styles & colors
│   ├── layout.tsx           ← Root layout
│   └── page.tsx             ← Main page
├── components/
│   ├── QuakeSidebar.tsx     ← Control panel (MAIN UPDATE)
│   ├── MapView.tsx          ← Map visualization
│   ├── PlanPanel.tsx        ← Response plan display (UPDATED)
│   └── ui/                  ← shadcn components
├── lib/
│   ├── api.ts               ← API calls
│   ├── types.ts             ← TypeScript definitions
│   └── mockData.ts          ← Demo data
├── public/                  ← Logo, assets
├── .env.local               ← Environment variables
├── package.json             ← Dependencies
└── tsconfig.json            ← TypeScript config
```

---

## Frontend Changes Made

### ✅ Color Scheme Updated
- Primary: Trust Blue (#0066cc)
- High Risk: Emergency Red (#dc2626)
- Medium Risk: Warning Amber (#f59e0b)
- Low Risk: Safety Green (#10b981)
- See [FRONTEND.md](FRONTEND.md) for details

### ✅ Accessibility Improved
- ARIA labels on all controls
- Semantic HTML with role attributes
- Keyboard navigation support
- High contrast ratios (WCAG AAA)
- Proper focus states

### ✅ Components Updated
- QuakeSidebar: Better visual hierarchy, emojis for clarity
- PlanPanel: Card-based layout with better organization
- Risk badges: More opaque, better contrast
- Buttons: Larger, clearer, more accessible

### ✅ Documentation Created
- [FRONTEND.md](FRONTEND.md) - Comprehensive frontend guide
- [HOW_TO_RUN.md](HOW_TO_RUN.md) - This file

---

## Next Development Steps

### Short Term (This Week)
- [ ] Test on real mobile devices
- [ ] Integrate PatriotAI for damage detection
- [ ] Add more earthquake data visualizations
- [ ] Create admin dashboard

### Medium Term (This Month)
- [ ] Deploy to DigitalOcean
- [ ] Integrate MongoDB Atlas for data persistence
- [ ] Setup GitHub Actions CI/CD
- [ ] Add unit tests with Vitest

### Long Term (Growth)
- [ ] Mobile app (React Native)
- [ ] Multilingual support
- [ ] Solana integration for payments
- [ ] ElevenLabs for voice in multiple languages

---

## Useful Resources

### Documentation
- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Leaflet Maps](https://leafletjs.com)

### Tools
- **DevTools**: F12 in browser
- **VS Code Extensions**: 
  - ES7+ React/Redux/React-Native snippets
  - Tailwind CSS IntelliSense
  - TypeScript Vue Plugin
- **API Testing**: Use Postman or `curl`

### Terminal Commands Cheat Sheet
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linter
npm run lint

# Open browser to localhost:3000
start http://localhost:3000
```

---

## Questions or Issues?

1. Check [FRONTEND.md](FRONTEND.md) for frontend-specific help
2. Check [backend/README.md](backend/README.md) for backend issues
3. Look at error messages in terminal/browser console
4. Try clearing cache and dependencies:
   ```bash
   rm -rf node_modules .next
   npm install
   npm run dev
   ```

---

## Summary

You now have:
- ✅ Modern, accessible frontend with emergency-focused design
- ✅ Backend running with real-time earthquake API
- ✅ Development environment ready for testing
- ✅ Comprehensive documentation

**Ready to test?** Open http://localhost:3000 and start exploring! 🚀

---

**Last Updated**: February 14, 2026  
**Frontend Version**: 1.0.0  
**Status**: Ready for testing and development
