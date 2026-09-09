from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .models import AppointmentStatus


class AppointmentFields(BaseModel):
    title: str = Field(..., min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    date: date
    start_time: time
    end_time: time

    @field_validator("title")
    @classmethod
    def title_must_have_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be empty")
        return value

    @field_validator("description")
    @classmethod
    def clean_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @model_validator(mode="after")
    def end_must_follow_start(self):
        if self.end_time <= self.start_time:
            raise ValueError("End time must be after start time")
        return self


class AppointmentCreate(AppointmentFields):
    pass


class AppointmentUpdate(AppointmentFields):
    pass


class AppointmentRead(AppointmentFields):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: AppointmentStatus
    created_at: datetime
    updated_at: datetime