import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select

from .crud import create_appointment
from .database import Base, SessionLocal, engine
from .models import Appointment, AppointmentStatus
from .routes.appointments import router as appointments_router
from .schemas import AppointmentCreate


SAMPLE_APPOINTMENTS = [
    AppointmentCreate(
        title="Team Standup",
        description="Daily alignment for the product and engineering team.",
        date="2026-09-10",
        start_time="09:00",
        end_time="09:30",
    ),
    AppointmentCreate(
        title="Client Meeting",
        description="Review the latest delivery milestones with the client.",
        date="2026-09-10",
        start_time="10:00",
        end_time="11:00",
    ),
    AppointmentCreate(
        title="Project Review",
        description="A completed review of the current sprint outcomes.",
        date="2026-09-10",
        start_time="11:30",
        end_time="12:15",
    ),
    AppointmentCreate(
        title="Technical Discussion",
        description="Explore options for the next integration milestone.",
        date="2026-09-11",
        start_time="13:00",
        end_time="14:00",
    ),
    AppointmentCreate(
        title="Interview",
        description="First-round conversation with a software engineering candidate.",
        date="2026-09-12",
        start_time="15:00",
        end_time="16:00",
    ),
]


def seed_sample_appointments() -> None:
    db = SessionLocal()
    try:
        if db.scalar(select(Appointment.id).limit(1)) is not None:
            return
        for index, payload in enumerate(SAMPLE_APPOINTMENTS):
            appointment = create_appointment(db, payload)
            if index == 2:
                appointment.status = AppointmentStatus.COMPLETED
            if index == 3:
                appointment.status = AppointmentStatus.CANCELLED
            if index in (2, 3):
                db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_sample_appointments()
    yield


app = FastAPI(
    title="Appointment Board API",
    description="A PostgreSQL-backed appointment management API for a small team.",
    version="1.0.0",
    lifespan=lifespan,
)

origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:8080").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unexpected_error_handler(_: Request, __: Exception):
    return JSONResponse(status_code=500, content={"detail": "Something went wrong. Please try again."})


@app.get("/", tags=["health"], summary="Health check")
def health_check():
    return {"status": "ok", "service": "appointment-board-api"}


app.include_router(appointments_router, prefix="/api")
app.include_router(appointments_router)