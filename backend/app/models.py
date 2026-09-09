from datetime import date, datetime, time
from enum import Enum

from sqlalchemy import Date, DateTime, Enum as SqlEnum, Integer, String, Text, Time, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class AppointmentStatus(str, Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    status: Mapped[AppointmentStatus] = mapped_column(
        SqlEnum(
            AppointmentStatus,
            name="appointment_status",
            values_callable=lambda enum_type: [item.value for item in enum_type],
        ),
        nullable=False,
        default=AppointmentStatus.SCHEDULED,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )