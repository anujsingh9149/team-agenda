from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..crud import (
    create_appointment,
    get_appointment,
    has_conflict,
    list_appointments,
    update_appointment,
    update_status,
)
from ..database import get_db
from ..models import AppointmentStatus
from ..schemas import AppointmentCreate, AppointmentRead, AppointmentUpdate

router = APIRouter(prefix="/api/appointments", tags=["appointments"])


def appointment_or_404(db: Session, appointment_id: int):
    appointment = get_appointment(db, appointment_id)
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment


@router.get(
    "",
    response_model=list[AppointmentRead],
    summary="List appointments",
    description="Return appointments sorted by date and start time, optionally filtered by date and status.",
)
def get_appointments(
    appointment_date: date | None = Query(default=None, alias="date"),
    status_filter: AppointmentStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
):
    return list_appointments(db, appointment_date, status_filter)


@router.post(
    "",
    response_model=AppointmentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create an appointment",
    description="Create an appointment after validating its time range and checking for overlaps.",
)
def post_appointment(payload: AppointmentCreate, db: Session = Depends(get_db)):
    if has_conflict(db, payload.date, payload.start_time, payload.end_time):
        raise HTTPException(status_code=409, detail="This time slot is already booked.")
    try:
        return create_appointment(db, payload)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=500, detail="Unable to save the appointment") from error


@router.get(
    "/{appointment_id}",
    response_model=AppointmentRead,
    summary="Get an appointment",
)
def get_one_appointment(appointment_id: int, db: Session = Depends(get_db)):
    return appointment_or_404(db, appointment_id)


@router.put(
    "/{appointment_id}",
    response_model=AppointmentRead,
    summary="Update an appointment",
    description="Replace an appointment's editable fields and re-check for an overlap excluding itself.",
)
def put_appointment(
    appointment_id: int, payload: AppointmentUpdate, db: Session = Depends(get_db)
):
    appointment = appointment_or_404(db, appointment_id)
    if has_conflict(db, payload.date, payload.start_time, payload.end_time, appointment_id):
        raise HTTPException(status_code=409, detail="This time slot is already booked.")
    try:
        return update_appointment(db, appointment, payload)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=500, detail="Unable to update the appointment") from error


@router.patch(
    "/{appointment_id}/complete",
    response_model=AppointmentRead,
    summary="Complete an appointment",
)
def complete_appointment(appointment_id: int, db: Session = Depends(get_db)):
    appointment = appointment_or_404(db, appointment_id)
    if appointment.status == AppointmentStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cancelled appointments cannot be completed")
    return update_status(db, appointment, AppointmentStatus.COMPLETED)


@router.patch(
    "/{appointment_id}/cancel",
    response_model=AppointmentRead,
    summary="Cancel an appointment",
    description="Mark an appointment as cancelled without deleting it. Cancelled appointments do not block time slots.",
)
def cancel_appointment(appointment_id: int, db: Session = Depends(get_db)):
    appointment = appointment_or_404(db, appointment_id)
    return update_status(db, appointment, AppointmentStatus.CANCELLED)


@router.delete(
    "/{appointment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an appointment",
    description="Administrative deletion endpoint. Normal users should cancel appointments instead.",
)
def delete_appointment(appointment_id: int, db: Session = Depends(get_db)):
    appointment = appointment_or_404(db, appointment_id)
    db.delete(appointment)
    db.commit()