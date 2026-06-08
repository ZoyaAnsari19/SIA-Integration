from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


class Attachment(BaseModel):
    type: Literal["image"]
    url: str


class ChatStreamRequest(BaseModel):
    message: str = Field(min_length=1)
    attachments: list[Attachment] = Field(default_factory=list)
    conversation_id: str | None = None


class ChatConfirmRequest(BaseModel):
    conversation_id: str
    confirmation_token: str
    confirm: bool = True
    transaction_pin: str | None = None


class ChatConversationListItem(BaseModel):
    conversation_id: str
    title: str
    updated_at: int
    created_at: int
    message_count: int


class ChatConversationTurnsResponse(BaseModel):
    conversation_id: str
    turns: list[dict]


class ChatConversationRenameRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)

