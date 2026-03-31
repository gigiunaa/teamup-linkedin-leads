# TeamUp LinkedIn Leads

LinkedIn lead capture system: Chrome extension + Flask API + Zoho CRM

## Flow

1. Sales opens LinkedIn profile
2. Clicks Salesforge extension → email found
3. Clicks copy on email → clipboard
4. Clicks TeamUp button → panel opens, email auto-filled from clipboard, name/country from LinkedIn
5. Clicks Send → Flask API → Zoho CRM lead created (tag: Inbound, source: Sales Team)

## Structure

```
teamup-lead-api/          # Flask API (deploy to Render.com)
teamup-linkedin-ext/      # Chrome Extension
```

## Setup

### 1. Deploy API to Render.com
- Root Directory: `teamup-lead-api`
- Build: `pip install -r requirements.txt`  
- Start: `gunicorn app:app`
- Env vars: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`

### 2. Install Chrome Extension
- `chrome://extensions` → Developer mode → Load unpacked → select `teamup-linkedin-ext`
- Extension Options → set API URL: `https://your-app.onrender.com/api/lead`
