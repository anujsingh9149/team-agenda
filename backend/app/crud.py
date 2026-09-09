from datetime import date, time

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from .models import Appointment, AppointmentStatus
from .schemas import AppointmentCreate, AppointmentUpdate


BLOCKING_STATUSES = (AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED)


def has_conflict(
    db: Session,
    appointment_date: date,
    start_time: time,
    end_time: time,
    exclude_id: int | None = None,
) -> bool:
    query = select(Appointment.id).where(
        and_(
            Appointment.date == appointment_date,
            Appointment.status.in_(BLOCKING_STATUSES),
            Appointment.start_time < end_time,
            Appointment.end_time > start_time,
        )
    )
    if exclude_id is not None:
        query = query.where(Appointment.id != exclude_id)
    return db.scalar(query) is not None


def list_appointments(
    db: Session, appointment_date: date | None = None, status: AppointmentStatus | None = None
) -> list[Appointment]:
    query = select(Appointment).order_by(Appointment.date, Appointment.start_time, Appointment.id)
    if appointment_date is not None:
        query = query.where(Appointment.date == appointment_date)
    if status is not None:
        query = query.where(Appointment.status == status)
    return list(db.scalars(query).all())


def get_appointment(db: Session, appointment_id: int) -> Appointment | None:
    return db.get(Appointment, appointment_id)


def create_appointment(db: Session, payload: AppointmentCreate) -> Appointment:
    appointment = Appointment(**payload.model_dump())
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


def update_appointment(
    db: Session, appointment: Appointment, payload: AppointmentUpdate
) -> Appointment:
    for key, value in payload.model_dump().items():
        setattr(appointment, key, value)
    db.commit()
    db.refresh(appointment)
    return appointment


def update_status(db: Session, appointment: Appointment, status: AppointmentStatus) -> Appointment:
    appointment.status = status
    db.commit()
    db.refresh(appointment)
    return appointment