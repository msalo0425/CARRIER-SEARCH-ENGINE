# Black Clover Logistics — Business Operating System

A full-stack private web platform for Black Clover Logistics, combining a live FMCSA carrier search engine, cold call CRM, subcontractor pipeline, and a complete government contracting business development suite.

---

## What's Included

| Module | Description |
|--------|-------------|
| **Carrier Search** | Search 600,000+ FMCSA carriers with 15+ filters |
| **Cold Call CRM** | Track outreach, log calls, schedule follow-ups |
| **Pipeline / Subcontractor Roster** | Manage your vetted carrier roster |
| **Opportunities Tracker** | Track government contract opportunities |
| **Sources Sought Tracker** | Manage sources sought responses |
| **Proposal Management** | Kanban board + detail view with sub-quote tracking |
| **Agency Relationship Manager** | Track relationships with government agencies |
| **Certifications & Compliance** | WOSB, SAM.gov, and other cert expiry tracking |
| **Document Library** | Upload and organize proposal documents |
| **Calendar & Reminders** | Deadlines, meetings, and follow-up dates |
| **Solicitation Aggregator** | Live SAM.gov + USASpending.gov feed |
| **Master Dashboard** | All KPIs in one view |
| **Settings & User Management** | Admin tools, FMCSA sync, role management |

**Three user roles:** `admin`, `sales_rep`, `viewer`

---

## Local Setup — Mac (Step by Step)

### 1. Install Prerequisites

You need **Node.js 20+**, **PostgreSQL 16**, and **npm** (included with Node).

```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js 20
brew install node@20
echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Install PostgreSQL 16
brew install postgresql@16
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Start PostgreSQL and enable it on login
brew services start postgresql@16

# Verify versions
node --version     # should be v20.x.x
psql --version     # should be psql (PostgreSQL) 16.x
```

### 2. Create the Database

```bash
# Connect to PostgreSQL as your Mac user
psql postgres

# Inside psql, run:
CREATE DATABASE bcl_db;
CREATE USER bcl_user WITH ENCRYPTED PASSWORD 'bcl_secure_pass';
GRANT ALL PRIVILEGES ON DATABASE bcl_db TO bcl_user;
\q
```

### 3. Configure the Backend

```bash
# Navigate to the project
cd /path/to/CARRIER-SEARCH-ENGINE/backend

# Copy the example env file
cp .env.example .env
```

Open `backend/.env` in a text editor and update these values:

```bash
# REQUIRED — update these:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bcl_db
DB_USER=bcl_user
DB_PASSWORD=bcl_secure_pass

JWT_SECRET=generate_a_strong_secret_here_at_least_64_chars_long_abc123xyz

# OPTIONAL — for live SAM.gov sync (leave blank to skip)
SAM_GOV_API_KEY=
FMCSA_API_TOKEN=
```

> **Generate a JWT secret:** Run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` and paste the output.

### 4. Install Backend Dependencies

```bash
# Still in the backend directory
npm install
```

### 5. Run Database Migrations

```bash
npm run migrate
```

You should see:
```
Running migration: 001_initial.sql
✓ 001_initial.sql completed
Running migration: 002_aggregator.sql
✓ 002_aggregator.sql completed
Running migration: 003_enhancements.sql
✓ 003_enhancements.sql completed
✓ All migrations completed successfully
```

### 6. Create Your Admin Account

```bash
npm run create-admin -- --email admin@yourcompany.com --password YourPassword123! --name "Your Name"
```

> You can also skip the arguments to use defaults:
> - Email: `admin@blackcloverlogistics.com`
> - Password: `Admin123!`
> - Name: `Admin`

### 7. Start the Backend Server

```bash
npm run dev
```

You should see:
```
✓ PostgreSQL connected
╔═══════════════════════════════════════════════════╗
║   BLACK CLOVER LOGISTICS — Business OS            ║
║   Server: http://localhost:3001                   ║
╚═══════════════════════════════════════════════════╝
```

**Leave this terminal open.** Open a new terminal tab for the frontend.

### 8. Install Frontend Dependencies

```bash
# In a NEW terminal tab
cd /path/to/CARRIER-SEARCH-ENGINE/frontend
npm install
```

### 9. Start the Frontend

```bash
npm run dev
```

You should see:
```
  VITE v5.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

### 10. Open the App

Go to **http://localhost:5173** in your browser.

You'll see the login page. Sign in with the credentials you created in Step 6.

---

## Syncing Carrier Data (FMCSA)

After logging in as admin, go to **Settings** → trigger an FMCSA sync to populate the carrier database.

Or run it from the terminal:
```bash
# In the backend directory
npm run sync-carriers
```

> The initial sync fetches all ~600,000 FMCSA carrier records. This takes several minutes. Subsequent nightly syncs are incremental and run automatically at 2 AM.

---

## Testing the Platform

Here's a quick checklist to verify each module is working:

**Authentication**
- [ ] Login with your admin credentials
- [ ] Try logging in with a wrong password — should show an error

**Carrier Search** (`/carriers`)
- [ ] Search for "trucking" — results should appear
- [ ] Filter by state "TX" — should narrow results
- [ ] Click a carrier to view their profile
- [ ] Click "Add to Pipeline" on a carrier profile

**Pipeline** (`/pipeline`)
- [ ] The carrier you added should appear here
- [ ] Edit pipeline notes and click "Save Notes"

**Cold Call CRM** (`/crm`)
- [ ] Switch to "All CRM Records" tab
- [ ] Click "Log" next to a carrier and log a call

**Opportunities** (`/opportunities`)
- [ ] Click "New Entry" and create a test opportunity
- [ ] Edit and delete it

**Sources Sought** (`/sources-sought`)
- [ ] Create a new sources sought entry
- [ ] Verify it appears in the stats cards

**Proposals** (`/proposals`)
- [ ] Click "New Proposal" and create a test proposal
- [ ] Drag the Kanban card to a different column
- [ ] Click the proposal to open details
- [ ] Add a sub-quote in the Sub Quotes tab

**Agencies** (`/agencies`)
- [ ] Create a new agency
- [ ] Select it from the list and log an interaction

**Certifications** (`/certifications`)
- [ ] Add a certification with an expiration date in the past — should appear red
- [ ] Add one expiring within 60 days — should appear amber

**Documents** (`/documents`)
- [ ] Upload a PDF file
- [ ] Download it back

**Calendar** (`/calendar`)
- [ ] Create an event on a future date
- [ ] Switch between month and list views

**Aggregator** (`/aggregator`)
- [ ] View the Solicitations tab (requires SAM.gov API key for live data)
- [ ] Click "Add to Proposals" on a solicitation

**Settings** (`/settings`) — Admin only
- [ ] Create a new user with `sales_rep` role
- [ ] Log out and log in as that user — verify they can't access Settings

---

## Docker Compose (Alternative — Full Stack)

If you prefer running the entire stack in Docker:

```bash
# In the project root
cp backend/.env.example .env

# Edit .env and set your passwords, then:
docker compose up --build
```

- Frontend: **http://localhost:3000**
- Backend API: **http://localhost:3001**

To create the admin user in Docker:
```bash
docker compose exec backend npm run create-admin -- --email admin@yourcompany.com --password YourPassword123!
```

To run migrations in Docker:
```bash
docker compose exec backend npm run migrate
```

---

## Project Structure

```
CARRIER-SEARCH-ENGINE/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Business logic
│   │   ├── db/
│   │   │   ├── migrations/  # SQL migration files
│   │   │   └── pool.ts      # PostgreSQL connection
│   │   ├── middleware/      # Auth, error handling
│   │   ├── routes/          # API routes
│   │   ├── scripts/         # createAdmin.ts
│   │   └── services/        # FMCSA sync, scheduler
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios client
│   │   ├── components/      # Layout, StatusBadge
│   │   ├── pages/
│   │   │   ├── carriers/    # Search, Profile
│   │   │   ├── govcon/      # All gov contracting pages
│   │   │   └── *.tsx        # Dashboard, CRM, Pipeline, etc.
│   │   ├── store/           # Zustand auth store
│   │   └── types/           # TypeScript interfaces
│   └── vite.config.ts
├── docker-compose.yml
└── README.md
```

---

## Troubleshooting

**PostgreSQL connection refused**
```bash
brew services restart postgresql@16
# If still failing, check your .env DB_HOST, DB_USER, DB_PASSWORD match what you set in psql
```

**"Cannot find module" error in backend**
```bash
cd backend && npm install
```

**Frontend shows blank page / network errors**
- Make sure the backend is running on port 3001 first
- Check the browser console for errors
- Vite dev server proxies `/api` → `http://localhost:3001`

**Migration fails with "column already exists"**
- This is safe to ignore — migrations use `ADD COLUMN IF NOT EXISTS`
- If it fails on something else, check that your PostgreSQL user has CREATE/ALTER privileges

**Login says "Invalid credentials"**
- Re-run `npm run create-admin` — it will tell you if the user already exists
- Check password meets requirements (at least 8 chars)

**Carrier search returns 0 results**
- FMCSA data hasn't been synced yet — go to Settings and trigger a sync
- Or run `npm run sync-carriers` in the backend directory
