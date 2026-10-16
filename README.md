# Group Study App — JavaScript starter

A backend-focused portfolio project. The frontend will be scaffolded with Vite + React (JavaScript); the backend starter is Express + PostgreSQL.

## 1. Prerequisites

- Node.js 22.12+ (prefer a current LTS release) and npm
- Docker Desktop with Compose, or your existing Docker-hosted PostgreSQL
- Git and a GitHub account
- Windows PowerShell commands below (also adaptable to macOS/Linux)

## 2. Extract the starter and create the client

Extract the ZIP contents to a new folder named `group-study-app`, then open PowerShell inside that folder:

```powershell
npm create vite@latest client -- --template react
cd client
npm install
cd ..
```

The Vite template includes a `.gitignore` for the frontend; the repository root also has one.

## 3. Set up the server

```powershell
cd server
npm install
Copy-Item .env.example .env
cd ..
```

- This creates `server/package-lock.json`, which **should be committed**.
- `server/.env` contains local secrets and **must not** be committed.
- Set the `DATABASE_URL` in `server/.env` if using your existing Docker PostgreSQL.

## 4. Start PostgreSQL locally

If you want a new local PostgreSQL on host port **5433**:

```powershell
docker compose up -d
```

This project maps `127.0.0.1:5433` to PostgreSQL's `5432` *inside* the container, avoiding a common collision with existing databases.

**If your existing Docker PostgreSQL already works**, skip `docker compose up -d`. Create or select a database and set its URL in `server/.env`.

Do not reuse the demo password or expose port 5433 publicly in production.

## 5. Apply migration and run the backend

```powershell
cd server
npm run migrate
npm run dev
```

Open a **second terminal**:

```powershell
curl.exe http://localhost:3000/health
curl.exe http://localhost:3000/health/db
```

Expected responses:

```json
{"status":"ok"}
{"status":"ok","database":"connected"}
```

`/health` checks the API process; `/health/db` checks PostgreSQL too.

## 6. Start the frontend

In another terminal, from the repository root:

```powershell
cd client
npm run dev
```

Vite will print its local frontend address (usually http://localhost:5173).

## 7. Git and GitHub

Create an **empty repository on GitHub** named `group-study-app`.

- For **Add .gitignore**, choose **None**, because this starter already has a root `.gitignore`.
- For **Initialize with README**, choose **No**, because `README.md` is already included.
- Avoid committing real `.env` files.

Then from your local project root:

```powershell
git init
git add .
git commit -m "chore: initialize group study app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/group-study-app.git
git push -u origin main
```

If you'd rather choose a GitHub `.gitignore` template for an empty repo, choose **Node** and add the custom exclusions from this starter. But to avoid conflicting initial commits, an empty remote is the easiest approach.

## Database schema (migration 001)

1. `users` — accounts
2. `auth_sessions` — hashed login session tokens
3. `study_groups` — private study groups
4. `group_members` — membership and group role
5. `study_sessions` — live study events
6. `session_participants` — per-session attendance
7. `documents` — PDFs in a study group (metadata; file bodies stored elsewhere)
8. `session_documents` — notes attached to sessions
9. `reading_progress` — page progress for each participating student
10. `messages` — chat, questions and answers

The migration runner also automatically creates `schema_migrations` to track applied migrations. That is an infrastructure table, not an application-domain table.

### Migration behavior

Run `npm run migrate` after adding a new numbered `.sql` file under `server/migrations`. The script runs unapplied migrations in filename order, within transactions, and records which versions were applied. You do not re-run the same version, and you must not edit a version that has already been deployed; add a new migration instead.

### Security and integrity considerations

- The schema establishes foreign keys, constraints, and indexes, but does **not** implement authorization routes or real login yet.
- An uploaded document must belong to the same group as its associated study session. Implement this check in your API transaction/service before insertion.
- An answer must refer to a question; `messages` includes the structural link, but the service validates the target kind.
- Only members of a group may access its notes, sessions, progress, or messages, checked in HTTP handlers and WebSocket room joins.
- For login, only a **hash** of the randomly generated opaque session token will be stored in `auth_sessions`. Use secure HttpOnly cookies and password hashing (Argon2id or bcrypt) when implementing auth.
- PDF bodies should be stored in managed object storage later, not in PostgreSQL.
- Once online, use a production database URL with encryption and never commit credentials.

## Next milestone

Add users + session authentication routes with validation, password hashing, rate limiting, and tests; then group creation and membership endpoints.
