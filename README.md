# 🏠 Berbera Smart House Numbering System

> AI-powered building detection, sequential numbering, and navigation system for Berbera, Somalia.

![License](https://img.shields.io/badge/license-MIT-blue) ![Next.js](https://img.shields.io/badge/Next.js-14-black) ![Node.js](https://img.shields.io/badge/Node.js-20-green) ![Python](https://img.shields.io/badge/Python-3.10+-yellow) ![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-purple)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 AI Detection | YOLOv8 satellite imagery building detection |
| 🗺️ Interactive Map | Leaflet + OpenStreetMap with clustering |
| 🔢 Sequential Numbers | Every building gets a unique number (1, 2, 3…) |
| 🔍 Search | Find any building by number instantly |
| 📍 My Position | GPS-based nearest building detection |
| 🧭 Navigation | Turn-by-turn walking & driving directions |
| 🔐 Admin Dashboard | CRUD, CSV import/export, JWT auth |
| 🌗 Dark / Light Mode | Beautiful glassmorphism UI |
| 🐳 Docker Ready | Full docker-compose deployment |
| ⚡ Scalable | Supports 100,000+ buildings with lazy loading |

---

## 📁 Project Structure

```
Mapping/
├── frontend/         # Next.js 14 + TypeScript + Tailwind CSS
├── backend/          # Node.js + Express REST API
├── ai-pipeline/      # Python YOLOv8 building detection
├── database/         # SQL schema + PostGIS functions
├── nginx/            # Reverse proxy configuration
├── docker-compose.yml
├── README.md
├── INSTALL.md
└── DEPLOYMENT.md
```

---

## 🚀 Quick Start

See [INSTALL.md](INSTALL.md) for detailed setup instructions.

```bash
# 1. Clone / open the project
cd Mapping

# 2. Setup backend
cd backend && copy .env.example .env   # Fill in Supabase credentials
npm install && npm run dev

# 3. Setup frontend (new terminal)
cd frontend && copy .env.example .env.local
npm install && npm run dev

# 4. Open http://localhost:3000
```

---

## 🔑 Default Admin Credentials

| Field | Value |
|---|---|
| URL | http://localhost:3000/admin |
| Username | `admin` |
| Password | `Berbera@2024!` |

> ⚠️ **Change the password** in `backend/.env` before deploying!

---

## 🤖 Running the AI Pipeline

```bash
cd ai-pipeline
pip install -r requirements.txt
copy .env.example .env   # Fill in Supabase credentials
python detect.py --zoom 16
```

The pipeline will:
1. Download satellite tiles for Berbera
2. Detect buildings using YOLOv8
3. Assign sequential numbers (1, 2, 3…)
4. Insert everything into your Supabase database

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/buildings` | List buildings (with bbox filter) |
| GET | `/api/search?q=137` | Find building by number |
| GET | `/api/navigation` | Get route between two points |
| POST | `/api/my-location` | Find nearest building to GPS |
| POST | `/api/admin/login` | Admin authentication |
| POST | `/api/buildings` | Create building |
| PUT | `/api/buildings/:id` | Update building |
| DELETE | `/api/buildings/:id` | Delete building |
| POST | `/api/import` | Import CSV |
| GET | `/api/export` | Export CSV |

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Leaflet.js
- **Backend**: Node.js, Express, JWT, Supabase JS client
- **Database**: Supabase (PostgreSQL + PostGIS)
- **AI**: Python, YOLOv8, OpenCV, Mercantile
- **Infrastructure**: Docker, Nginx, Vercel

---

## 📄 License

MIT — Free to use, modify, and deploy.
