# Appointment Board implementation plan

## User-facing result
- A polished, responsive Appointment Board at `/` with date/status filters, sorted appointment cards, clear status treatments, add/edit forms, completion, cancellation confirmation, loading, empty, success, and friendly error states.
- The React UI calls a separately runnable FastAPI service through `VITE_API_URL`; it does not use browser storage or mock data.
- A PostgreSQL-backed FastAPI service under `backend/` with validation, conflict prevention, sample seed records, CORS, and OpenAPI docs.
- A complete README with setup, environment variables, API reference, conflict rules, assumptions, and local run commands.

## Implementation
1. Add the FastAPI service structure: SQLAlchemy database/model layer, Pydantic request/response schemas, CRUD/conflict logic, appointment routes, startup table initialization and idempotent sample seeding.
2. Add a typed frontend API client with Zod form validation and user-friendly mapping for validation, conflict, not-found, and network errors.
3. Build the board UI and reusable controls: header, filter bar, cards, modal form, cancel confirmation, status badges, toast notifications, loading skeleton, and empty/error states.
4. Replace starter metadata/design tokens and document the project, without introducing frontend-only persistence or a second backend.
5. Validate with the frontend build/lint and targeted backend syntax/logic checks where the local Python environment permits.

## Technical details
- Backend: Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2, PostgreSQL/psycopg, `DATABASE_URL` from `.env`.
- Frontend: TypeScript, React, Tailwind CSS v4, `VITE_API_URL` from `.env`; all API mutations use fetch and refetch the board.
- Conflict rule: only `scheduled` and `completed` appointments block; overlap is `new_start < existing_end && new_end > existing_start`; updates exclude their own id.
- Cancelled appointments remain queryable/displayed and are never blockers.
