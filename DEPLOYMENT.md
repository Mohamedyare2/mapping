# 🚀 Deployment Guide — Berbera Smart House Numbering System

## Option A: Vercel (Frontend) + Railway/Render (Backend) — Recommended

### Deploy Frontend to Vercel

1. Push project to GitHub
2. Go to **https://vercel.com** → Import project → select `frontend/` folder
3. Set environment variables in Vercel dashboard:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app/api
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Deploy → your frontend is live

### Deploy Backend to Railway

1. Go to **https://railway.app** → New Project → Deploy from GitHub
2. Select the `backend/` folder
3. Set environment variables (same as `backend/.env`)
4. Railway auto-detects Node.js and deploys

---

## Option B: Docker Compose (self-hosted VPS)

### Requirements
- Ubuntu 22.04+ VPS (2 GB RAM minimum)
- Docker + Docker Compose installed
- Domain name (optional but recommended for HTTPS)

### Setup

```bash
# Clone / copy project to server
scp -r Mapping/ user@your-server:/opt/berbera

# On the server
cd /opt/berbera

# Create env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Edit with your values
nano backend/.env
nano frontend/.env.local

# Start all services
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

### Services will be available at:
- Frontend: http://your-server-ip (via Nginx)
- Backend API: http://your-server-ip/api
- Health check: http://your-server-ip/health

### Add HTTPS (with Let's Encrypt)

```bash
# Install certbot
apt install certbot

# Get certificate (replace with your domain)
certbot certonly --standalone -d yourdomain.com

# Add SSL paths to nginx/nginx.conf:
# ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

# Restart nginx
docker-compose restart nginx
```

---

## Option C: Manual VPS Deployment (without Docker)

```bash
# Backend
cd backend
npm install
npm install -g pm2
cp .env.example .env && nano .env
pm2 start src/index.js --name berbera-backend
pm2 save && pm2 startup

# Frontend
cd frontend
npm install
npm run build
pm2 start npm --name berbera-frontend -- start
pm2 save

# Install nginx
apt install nginx
cp nginx/nginx.conf /etc/nginx/nginx.conf
systemctl restart nginx
```

---

## Running the AI Pipeline on a Server

```bash
cd ai-pipeline
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env && nano .env

# Run detection (this inserts into the production database)
python detect.py --zoom 16 2>&1 | tee detection-$(date +%Y%m%d).log

# Schedule monthly re-scan for new buildings:
# crontab -e
# 0 2 1 * * cd /opt/berbera/ai-pipeline && source venv/bin/activate && python detect.py --zoom 16
```

---

## Production Checklist

- [ ] Change `ADMIN_PASSWORD` in `backend/.env`
- [ ] Change `JWT_SECRET` to a long random string (32+ chars)
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS
- [ ] Set `CORS_ORIGIN` to your actual frontend domain only
- [ ] Configure firewall: only expose ports 80 and 443
- [ ] Set up database backups in Supabase dashboard (Settings → Database → Backups)
- [ ] Monitor with: `docker-compose logs -f backend`
