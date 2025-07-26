# Deployment Guide for News Briefings App

This guide will help you deploy your News Briefings App on Vercel.

## Overview

Your app consists of:
- **Frontend**: React + Vite (deploy on Vercel)
- **Backend**: Python Flask API (deploy separately)
- **Database**: Supabase (already hosted)

## Step 1: Deploy the Backend

### Option A: Deploy on Railway (Recommended)

1. **Sign up for Railway** (railway.app)
2. **Connect your GitHub repository**
3. **Create a new project** and select your repository
4. **Set environment variables**:
   ```
   OPENAI_API_KEY=your_openai_api_key
   SUPABASE_DB_HOST=your_supabase_db_host
   SUPABASE_DB_PASSWORD=your_supabase_db_password
   SUPABASE_DB_PORT=5432
   SUPABASE_DB_NAME=postgres
   SUPABASE_DB_USER=postgres
   ```
5. **Deploy** - Railway will automatically detect your Python app
6. **Get your backend URL** (e.g., `https://your-app.railway.app`)

### Option B: Deploy on Render

1. **Sign up for Render** (render.com)
2. **Create a new Web Service**
3. **Connect your GitHub repository**
4. **Configure the service**:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python backend_api.py`
   - **Environment**: Python 3
5. **Set environment variables** (same as above)
6. **Deploy and get your backend URL**

## Step 2: Deploy the Frontend on Vercel

### 1. **Prepare Your Frontend**

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Set up environment variables**:
   Create a `.env` file in the `frontend` directory:
   ```
   VITE_API_BASE_URL=https://your-backend-url.com
   ```

3. **Update API calls** (if needed):
   The config.ts file should handle this automatically.

### 2. **Deploy to Vercel**

#### Method A: Using Vercel CLI

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Follow the prompts**:
   - Link to existing project or create new
   - Set project name
   - Confirm deployment settings

#### Method B: Using Vercel Dashboard

1. **Go to [vercel.com](https://vercel.com)**
2. **Import your GitHub repository**
3. **Configure the project**:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Set environment variables**:
   - `VITE_API_BASE_URL`: Your backend URL
5. **Deploy**

### 3. **Configure Environment Variables in Vercel**

In your Vercel dashboard:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add:
   ```
   VITE_API_BASE_URL=https://your-backend-url.com
   ```

## Step 3: Update Database Schema

Before deploying, make sure to run the database update script in your Supabase SQL Editor:

```sql
-- Update briefing_configs table to support multiple briefings per user
ALTER TABLE briefing_configs DROP CONSTRAINT IF EXISTS briefing_configs_user_id_key;
ALTER TABLE briefing_configs ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'My Briefing';
ALTER TABLE briefing_configs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE briefing_configs ADD CONSTRAINT briefing_configs_user_id_name_key UNIQUE(user_id, name);
DROP INDEX IF EXISTS idx_briefing_configs_user_id;
CREATE INDEX IF NOT EXISTS idx_briefing_configs_user_id_name ON briefing_configs(user_id, name);
```

## Step 4: Test Your Deployment

1. **Test the backend**: Visit your backend URL + `/health` (if you have a health endpoint)
2. **Test the frontend**: Visit your Vercel URL
3. **Test the full flow**: Login, create briefings, generate news

## Troubleshooting

### Common Issues:

1. **CORS Errors**:
   - Add CORS headers to your backend
   - Update your backend to allow requests from your Vercel domain

2. **Environment Variables**:
   - Make sure all environment variables are set in both backend and frontend
   - Check that variable names match exactly

3. **API Connection**:
   - Verify your backend URL is correct
   - Check that your backend is running and accessible

4. **Database Connection**:
   - Ensure your Supabase credentials are correct
   - Check that your IP is allowed in Supabase

### Backend CORS Configuration

Add this to your `backend_api.py`:

```python
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=["https://your-vercel-domain.vercel.app"])
```

## Final Notes

- **Custom Domain**: You can add a custom domain in Vercel settings
- **Environment Variables**: Remember to set them for production
- **Monitoring**: Use Vercel Analytics to monitor your app's performance
- **Updates**: Push to your main branch to trigger automatic deployments

Your app should now be live and accessible to users worldwide! 