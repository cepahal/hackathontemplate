"""File ingestion: filename, size, extension allowlist, magic bytes vs extension, UTF-8 text, PDF checks."""

import pytest

from app.ai.files import (
    FileKind,
    FileTooLargeError,
    IngestedFile,
    InvalidFileError,
    UnsupportedFileError,
    ingest_file,
    sanitize_filename,
)
from app.core.errors import AppError

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 32
GIF = b"GIF89a" + b"\x00" * 32
WEBP = b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 32
PDF = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n"
ALL_KINDS: frozenset[FileKind] = frozenset({"text", "image", "pdf"})


def ingest(
    name: str | None, data: bytes, kinds: frozenset[FileKind] = ALL_KINDS, max_bytes: int = 10_000
) -> IngestedFile:
    return ingest_file(name, data, allowed_kinds=kinds, max_bytes=max_bytes, max_text_chars=1_000)


def error_code(exc: pytest.ExceptionInfo[AppError]) -> str:
    return exc.value.code


@pytest.mark.parametrize(
    ("name", "data", "media_type", "kind"),
    [
        ("photo.png", PNG, "image/png", "image"),
        ("photo.JPG", JPEG, "image/jpeg", "image"),
        ("photo.jpeg", JPEG, "image/jpeg", "image"),
        ("anim.gif", GIF, "image/gif", "image"),
        ("pic.webp", WEBP, "image/webp", "image"),
        ("doc.pdf", PDF, "application/pdf", "pdf"),
        ("notes.txt", "héllo wörld\n\tindented".encode(), "text/plain", "text"),
        ("README.md", b"\xef\xbb\xbf# Title", "text/markdown", "text"),
    ],
)
def test_valid_files(name: str, data: bytes, media_type: str, kind: str) -> None:
    result = ingest(name, data)
    assert (result.media_type, result.kind, result.size) == (media_type, kind, len(data))
    assert len(result.sha256) == 64
    assert "data" not in result.info()
    if kind == "text":
        assert result.text is not None and not result.text.startswith("\ufeff")
        with pytest.raises(ValueError, match="context"):
            result.attachment()
    else:
        assert result.text is None
        assert result.attachment().media_type == media_type


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("../../etc/passwd.txt", "passwd.txt"),
        ("C:\\Users\\me\\report.pdf", "report.pdf"),
        ("my <script>.png", "my _script_.png"),
        ("résumé.txt", "résumé.txt"),
    ],
)
def test_filenames_are_reduced_to_a_safe_basename(raw: str, expected: str) -> None:
    assert sanitize_filename(raw) == expected


@pytest.mark.parametrize("raw", [None, "", "   ", ".", "..", "dir/", "evil\x00.png", "line\nbreak.txt", "x" * 256])
def test_invalid_filenames_are_rejected(raw: str | None) -> None:
    with pytest.raises(InvalidFileError) as exc:
        sanitize_filename(raw)
    assert exc.value.code == "FILE_NAME_INVALID"


def test_oversized_file_is_rejected_before_inspection() -> None:
    with pytest.raises(FileTooLargeError) as exc:
        ingest("big.png", PNG + b"\x00" * 100, max_bytes=50)
    assert exc.value.status_code == 413


def test_empty_file_is_rejected() -> None:
    with pytest.raises(InvalidFileError) as exc:
        ingest("empty.png", b"")
    assert exc.value.code == "FILE_EMPTY"


@pytest.mark.parametrize("name", ["tool.exe", "page.html", "image.svg", "archive.zip", "noextension"])
def test_unlisted_extensions_are_rejected(name: str) -> None:
    with pytest.raises(UnsupportedFileError) as exc:
        ingest(name, b"MZ\x90\x00")
    assert exc.value.status_code == 415


@pytest.mark.parametrize(
    ("name", "data"),
    [
        ("fake.png", b"<?php system($_GET['c']); ?>"),  # script renamed to .png
        ("fake.png", JPEG),  # real image, wrong extension
        ("fake.pdf", PNG),
        ("fake.jpg", b"%PDF-1.4 ..."),
        ("sneaky.txt", PNG),  # binary hidden behind a text extension
    ],
)
def test_extension_alone_is_never_trusted(name: str, data: bytes) -> None:
    with pytest.raises(InvalidFileError) as exc:
        ingest(name, data)
    assert exc.value.code == "FILE_TYPE_MISMATCH"


@pytest.mark.parametrize(
    ("data", "code"),
    [
        (b"\xff\xfe\x00latin-1 or utf-16", "FILE_NOT_TEXT"),
        (b"ok text \x00 with a NUL", "FILE_NOT_TEXT"),
        (b"bell \x07 char", "FILE_NOT_TEXT"),
        (b"  \n\t ", "FILE_EMPTY"),
    ],
)
def test_text_files_must_be_clean_utf8(data: bytes, code: str) -> None:
    with pytest.raises(InvalidFileError) as exc:
        ingest("notes.txt", data)
    assert exc.value.code == code


def test_text_longer_than_context_limit_is_rejected() -> None:
    with pytest.raises(FileTooLargeError):
        ingest("long.txt", b"a" * 1_001)


@pytest.mark.parametrize(
    ("data", "error", "code"),
    [
        (b"%PDF-9.9\n%%EOF", InvalidFileError, "FILE_INVALID_PDF"),
        (b"%PDF-1.7\n1 0 obj << >> endobj\n", InvalidFileError, "FILE_INVALID_PDF"),  # truncated: no %%EOF
        (b"%PDF-1.7\ntrailer << /Encrypt 5 0 R >>\n%%EOF", UnsupportedFileError, "FILE_PDF_ENCRYPTED"),
    ],
)
def test_pdf_structure_checks(data: bytes, error: type[AppError], code: str) -> None:
    with pytest.raises(error) as exc:
        ingest("doc.pdf", data)
    assert exc.value.code == code


def test_kind_must_be_allowed_for_the_endpoint() -> None:
    with pytest.raises(UnsupportedFileError):
        ingest("doc.pdf", PDF, kinds=frozenset({"image"}))
    with pytest.raises(UnsupportedFileError):
        ingest("notes.txt", b"hello", kinds=frozenset({"image"}))
