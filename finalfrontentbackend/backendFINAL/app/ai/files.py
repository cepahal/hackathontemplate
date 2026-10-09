"""Generic file ingestion: validate an upload once, then hand typed content to the AI layer.

Checks, in order: filename (sanitised, no paths/control characters), size, allowed extension,
actual content (magic bytes / strict UTF-8) agreeing with the extension, and kind allowed for the
endpoint. The client's Content-Type header is ignored, and the extension alone is never trusted.

Supported kinds:
- text  (.txt, .md)   decoded as UTF-8 and passed to the model as context
- image (.png, .jpg/.jpeg, .webp, .gif)  passed to the provider as an attachment
- pdf   (.pdf)        structurally checked (header, EOF marker, not encrypted) and passed to
                      providers that read PDFs natively. No local text extraction is bundled.
"""

import hashlib
import re
import unicodedata
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Literal, cast

from app.ai.providers.base import Attachment, AttachmentMediaType
from app.core.errors import BadRequestError, PayloadTooLargeError, UnsupportedMediaTypeError

FileKind = Literal["text", "image", "pdf"]

EXTENSION_TYPES: dict[str, str] = {
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
}
TEXT_TYPES = frozenset({"text/plain", "text/markdown"})

_UNSAFE_FILENAME_CHARS = re.compile(r"[^\w .()\-]")
_FILENAME_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")
# Control characters other than tab, newline, form feed and carriage return.
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0e-\x1f\x7f]")


class InvalidFileError(BadRequestError):
    code = "FILE_INVALID"
    message = "The file is not valid"


class FileTooLargeError(PayloadTooLargeError):
    code = "FILE_TOO_LARGE"


class UnsupportedFileError(UnsupportedMediaTypeError):
    code = "FILE_TYPE_UNSUPPORTED"


@dataclass(frozen=True, slots=True)
class IngestedFile:
    filename: str
    media_type: str
    kind: FileKind
    size: int
    sha256: str
    data: bytes
    text: str | None = None

    def attachment(self) -> Attachment:
        if self.kind == "text":
            raise ValueError("text files are passed as context, not as attachments")
        return Attachment(media_type=cast(AttachmentMediaType, self.media_type), data=self.data, filename=self.filename)

    def info(self) -> dict[str, object]:
        """Metadata safe to store in history (never the bytes)."""
        return {
            "filename": self.filename,
            "media_type": self.media_type,
            "kind": self.kind,
            "size": self.size,
            "sha256": self.sha256,
        }


def sanitize_filename(name: str | None) -> str:
    """Basename only, NFC-normalised, unsafe characters replaced. Rejects empty/dot/control names."""
    if not name:
        raise InvalidFileError("The file needs a name", code="FILE_NAME_INVALID")
    base = unicodedata.normalize("NFC", name).replace("\\", "/").rsplit("/", 1)[-1].strip()
    if not base or base in {".", ".."} or _FILENAME_CONTROL_CHARS.search(base) or len(base) > 255:
        raise InvalidFileError("The file name is not valid", code="FILE_NAME_INVALID")
    return _UNSAFE_FILENAME_CHARS.sub("_", base)


def sniff_media_type(data: bytes) -> str | None:
    """Media type from magic bytes, for the binary types we accept."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    return None


def decode_text(data: bytes) -> str:
    try:
        text = data.removeprefix(b"\xef\xbb\xbf").decode("utf-8")
    except UnicodeDecodeError:
        raise InvalidFileError("Text files must be UTF-8 encoded", code="FILE_NOT_TEXT") from None
    if _CONTROL_CHARS.search(text):
        raise InvalidFileError("The file contains binary data, not text", code="FILE_NOT_TEXT")
    if not text.strip():
        raise InvalidFileError("The file is empty", code="FILE_EMPTY")
    return text


def validate_pdf(data: bytes) -> None:
    if not re.match(rb"%PDF-[12]\.\d", data):
        raise InvalidFileError("The PDF header is invalid", code="FILE_INVALID_PDF")
    if b"%%EOF" not in data[-2048:]:
        raise InvalidFileError("The PDF is truncated or malformed", code="FILE_INVALID_PDF")
    if b"/Encrypt" in data:
        raise UnsupportedFileError("Encrypted PDFs are not supported", code="FILE_PDF_ENCRYPTED")


def ingest_file(
    filename: str | None,
    data: bytes,
    *,
    allowed_kinds: frozenset[FileKind],
    max_bytes: int,
    max_text_chars: int,
) -> IngestedFile:
    name = sanitize_filename(filename)
    if not data:
        raise InvalidFileError("The file is empty", code="FILE_EMPTY")
    if len(data) > max_bytes:
        raise FileTooLargeError(f"Files must be at most {max_bytes // 1024} KB")

    declared = EXTENSION_TYPES.get(PurePosixPath(name).suffix.lower())
    if declared is None:
        allowed = ", ".join(sorted(EXTENSION_TYPES))
        raise UnsupportedFileError(f"Unsupported file extension. Allowed: {allowed}")

    sniffed = sniff_media_type(data)
    text: str | None = None
    if declared in TEXT_TYPES:
        if sniffed is not None:
            raise InvalidFileError("The file content does not match its extension", code="FILE_TYPE_MISMATCH")
        text = decode_text(data)
        if len(text) > max_text_chars:
            raise FileTooLargeError(f"Text files must be at most {max_text_chars} characters")
        kind: FileKind = "text"
    elif sniffed != declared:
        raise InvalidFileError("The file content does not match its extension", code="FILE_TYPE_MISMATCH")
    else:
        kind = "pdf" if declared == "application/pdf" else "image"

    if kind not in allowed_kinds:
        raise UnsupportedFileError(f"{kind} files are not accepted here")
    if kind == "pdf":
        validate_pdf(data)

    return IngestedFile(
        filename=name,
        media_type=declared,
        kind=kind,
        size=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
        data=data,
        text=text,
    )
