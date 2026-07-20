# 📦 Installation Guide — Berbera Smart House Numbering System

## Prerequisites

| Tool | Version | Download |
|---|---|---|
| Node.js | 18 or 20 | https://nodejs.org |
| npm | 9+ | (bundled with Node) |
| Python | 3.10+ | https://python.org |
| Git | Any | https://git-scm.com |
| Docker | 24+ (optional) | https://docker.com |

---

## Step 1: Create Supabase Project

1. Go to **https://supabase.com** → Sign up / Sign in
2. Click **"New Project"**
3. Give it a name: `berbera-housing`
4. Choose a region close to Somalia (EU West or similar)
5. Save your **Database Password**

### Enable PostGIS
1. In your project, go to **SQL Editor**
2. Paste and run `database/schema.sql`
3. Then paste and run `database/functions.sql`

### Get your API keys
1. Go to **Settings → API**
2. Copy:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2: Backend Setup

```bash
cd backend

# Create environment file
copy .env.example .env

# Edit .env with your Supabase credentials and admin password
# Use Notepad or any editor:
notepad .env

# Install dependencies
npm install

# Start development server
npm run dev
```

The backend will be available at **http://localhost:4000**

Test it: open http://localhost:4000/health in your browser.

---

## Step 3: Frontend Setup

```bash
cd frontend

# Create environment file
copy .env.example .env.local

# Edit .env.local — set NEXT_PUBLIC_API_URL=http://localhost:4000/api
notepad .env.local

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at **http://localhost:3000**

---

## Step 4: AI Pipeline Setup (Optional)

> Skip this if you don't have buildings in the database yet. You can add buildings manually via Admin Dashboard.

```bash
cd ai-pipeline

# Create environment file
copy .env.example .env
notepad .env

# Create Python virtual environment
python -m venv venv
venv\Scripts\activate    # Windows

# Install dependencies (this downloads PyTorch + YOLOv8)
pip install -r requirements.txt

# Run detection (downloads satellite tiles + detects buildings)
python detect.py --zoom 16

# For faster results with less accuracy:
# python detect.py --zoom 15
```

> **Note**: First run downloads the YOLOv8 model (~6 MB). Tile downloads may take 5–30 minutes depending on zoom level. Set `ZOOM_LEVEL=15` for faster processing with less detail.

---

## Step 5: Verify Everything Works

1. Open **http://localhost:3000** → map should load centered on Berbera
2. If AI pipeline ran: building numbers should appear on the map
3. Open **http://localhost:3000/admin** → login with admin credentials
4. Try searching for building `1` in the search box

---

## Admin Dashboard

| URL | Credentials |
|---|---|
| http://localhost:3000/admin | Username: `admin`, Password: `Berbera@2024!` |

> **Security**: Change these in `backend/.env` before going live:
> ```
> ADMIN_USERNAME=your-username
> ADMIN_PASSWORD=your-secure-password
> JWT_SECRET=your-long-random-secret
> ```

---

## Troubleshooting

### Map shows no buildings
→ Run the AI pipeline or add buildings manually in the Admin Dashboard

### Backend "Missing SUPABASE_URL" error
→ Make sure `backend/.env` has valid Supabase credentials

### Frontend "Failed to fetch" error
→ Make sure backend is running on port 4000, and `NEXT_PUBLIC_API_URL` is set correctly

### GPS location not working
→ Your browser needs HTTPS or localhost to access GPS. This works on localhost.

### AI pipeline has no detections
→ For better results, replace the `TILE_URL` in `detect.py` with Mapbox Satellite API (requires free token)
