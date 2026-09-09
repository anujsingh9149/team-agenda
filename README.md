# Appointment Board

Appointment Board is a small-team scheduling workspace built as a technical assignment for a Full Stack Developer Intern role. The React frontend communicates with a separate FastAPI REST API, which persists appointments in PostgreSQL through SQLAlchemy.

## Features

- View appointments sorted by date and start time
- Add and edit appointments with client- and server-side validation
- Complete appointments without removing them from the board
- Cancel appointments while keeping them visible in history
- Filter by date and status, including combined filters
- Backend conflict prevention for scheduled and completed appointments
- Cancelled appointments do not block a time slot
- Loading, empty, error, confirmation, and toast states
- FastAPI Swagger docs at `/docs`

## Tech stack

- Frontend: React 19, TypeScript, TanStack Start, Tailwind CSS v4, Zod
- Backend: Python, FastAPI, Pydantic v2, SQLAlchemy 2
- Database: PostgreSQL

## Architecture

```text
React / TanStack Start (frontend)
          |
          | JSON REST requests via VITE_API_URL
          v
FastAPI (backend/app)
          |
          | SQLAlchemy + psycopg
          v
PostgreSQL
```

The frontend has no appointment persistence or mock data. The backend owns validation, conflict checks, mutations, and sample seeding.

## Folder structure

```text
backend/
  app/
    main.py              # FastAPI app, CORS, startup seeding
    database.py          # SQLAlchemy engine and sessions
    models.py            # Appointment model and status enum
    schemas.py           # Pydantic request/response validation
    crud.py               # Query and mutation helpers
    routes/appointments.py
  requirements.txt
  .env.example
src/
  lib/api.ts             # Typed frontend API client and Zod form schema
  routes/index.tsx       # Appointment Board UI
  styles.css             # Design tokens and responsive styles
```

## Prerequisites

- Python 3.11 or newer
- Node.js 20+ and npm (or Bun)
- PostgreSQL 14+

## PostgreSQL setup

Create a database named `appointment_board`:

```bash
createdb appointment_board
```

Copy `backend/.env.example` to `backend/.env` and update the credentials:

```env
DATABASE_URL=postgresql+psycopg://username:password@localhost:5432/appointment_board
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080
```

The API creates the `appointments` table at startup and inserts five sample appointments only when the table is empty. For production, use Alembic migrations rather than startup table creation.

## Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API base URL: `http://localhost:8000/api`  
Swagger UI: `http://localhost:8000/docs`

## Frontend setup

From the repository root:

```bash
npm install
cp .env.example .env       # create manually on Windows
npm run dev
```

Frontend environment variable:

```env
VITE_API_URL=http://localhost:8000/api
```

The existing TanStack Start dev server defaults to `http://localhost:5173` when run with Vite; in this hosted workspace it may use another preview port. Add that origin to `ALLOWED_ORIGINS` if needed.

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/appointments?date=YYYY-MM-DD&status=scheduled` | List and filter appointments |
| POST | `/api/appointments` | Create an appointment |
| GET | `/api/appointments/{id}` | Get one appointment |
| PUT | `/api/appointments/{id}` | Update editable appointment fields |
| PATCH | `/api/appointments/{id}/complete` | Mark as completed |
| PATCH | `/api/appointments/{id}/cancel` | Mark as cancelled, retaining history |
| DELETE | `/api/appointments/{id}` | Administrative deletion |

## Conflict logic

For appointments on the same date, an overlap exists when:

```text
new_start < existing_end AND new_end > existing_start
```

Only `scheduled` and `completed` appointments are considered occupied. Cancelled appointments never block a new appointment. Updates exclude their own id from the check. Adjacent appointments such as 10:00–11:00 and 11:00–12:00 are allowed.

## Sample data

Startup seeds five non-overlapping records: Team Standup, Client Meeting, Project Review (completed), Technical Discussion (cancelled), and Interview. Seeding is idempotent and does not overwrite existing data.

## Assumptions

- Appointments are team-wide; authentication and individual ownership are outside this assignment's scope.
- Times are stored as PostgreSQL `TIME` values and interpreted in the team's local timezone.
- Normal users cancel instead of deleting; DELETE remains available for administration.
- Startup table creation is intentionally simple for the assignment; a migration tool is the next production improvement.

## Future improvements

- Alembic migrations and automated database backups
- User authentication, team membership, and per-user permissions
- Timezone-aware appointment storage
- Pagination and calendar/week views
- Automated backend integration tests and CI