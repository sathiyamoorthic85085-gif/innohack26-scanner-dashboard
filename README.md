# InnoHack-26 · Standalone Meal Scanner & Head Count Dashboard

This is the **standalone, organizer-only On-The-Spot Meal Scanner & Live Head Count Redemption Dashboard** for InnoHack-26.

---

## Features

- 📸 **Live Camera QR Scanner**: Fast rear-camera scanning of attendee mobile screens.
- ⚡ **Physical Barcode / USB Scanner Support**: Keyboard-wedge and manual token ID entry.
- 📊 **Real-time Live Head Count Analytics**: Displays served vs eligible head count for all 6 meal/snack slots.
- 🍽️ **1-Tap Instant Meal Redemption & Undo**: Instant stamps with timestamp and organizer attribution.
- 🔊 **Audio & Visual Feedback**: Beeps on successful scan / error.
- 📥 **Export Report**: Download full head count tally as CSV.
- 🔒 **Organiser Email Authentication Gate**: Session stored securely in local state.

---

## 🚀 Quick Start (Run Locally)

```bash
cd scanner-dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Deploy to Vercel (1-Click Standalone Deployment)

### Method 1: Using Vercel CLI
```bash
cd scanner-dashboard
npx vercel
```

### Method 2: Push to GitHub & Import in Vercel
1. Create a new repository on GitHub (e.g. `innohack26-scanner-dashboard`).
2. Push this folder to your repository:
   ```bash
   cd scanner-dashboard
   git init
   git add -A
   git commit -m "Initial commit: InnoHack-26 Scanner Dashboard"
   git remote add origin https://github.com/your-username/innohack26-scanner-dashboard.git
   git branch -M main
   git push -u origin main
   ```
3. In [Vercel Dashboard](https://vercel.com/dashboard), click **"Add New Project"** -> **Import Git Repository**.
4. Framework Preset: **Vite** (Zero configuration needed).
5. (Optional) Set Environment Variable:
   - `VITE_API_BASE`: `https://innohack26.vercel.app`
6. Click **Deploy**.
