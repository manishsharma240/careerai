"""
CareerAI file validation service.
Validates uploaded files server-side — never trust the client's claim about file type.
Supports PDF and DOCX resumes.
"""
import hashlib
import logging
import os
import re
import secrets
import zipfile
import io

from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

PDF_MAGIC = b"%PDF-"
# DOCX files are ZIP archives — the ZIP local file header signature
DOCX_MAGIC = b"PK\x03\x04"
MAX_FILENAME_LEN = 255
ALLOWED_EXTENSIONS = {".pdf", ".docx"}
SAFE_FILENAME_RE = re.compile(r"[^a-zA-Z0-9._-]")


def _safe_extension(filename: str) -> str:
    """Extract and validate the file extension."""
    _, ext = os.path.splitext(filename)
    return ext.lower()


def _is_valid_docx(content: bytes) -> bool:
    """
    A DOCX file is a ZIP archive that must contain the standard OOXML
    document parts. Checking magic bytes alone (PK\\x03\\x04) is not enough —
    plain ZIPs and other Office formats share that signature — so we also
    confirm the archive actually contains word/document.xml.
    """
    if not content.startswith(DOCX_MAGIC):
        return False
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            names = zf.namelist()
            return "word/document.xml" in names and "[Content_Types].xml" in names
    except zipfile.BadZipFile:
        return False


async def validate_resume_upload(file: UploadFile) -> tuple[bytes, str]:
    """
    Fully validate an uploaded resume file (PDF or DOCX):
    1. Extension check
    2. Size check
    3. Format-specific signature check (PDF magic bytes / real DOCX archive structure)
    Returns (file_bytes, detected_extension). Raises HTTPException otherwise.
    """
    ext = _safe_extension(file.filename or "")
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PDF and DOCX files are accepted.",
        )

    # Read file (bounded by max size + 1 byte so we can detect oversized files)
    max_bytes = settings.MAX_UPLOAD_BYTES
    content = await file.read(max_bytes + 1)

    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the maximum allowed size of {max_bytes // (1024*1024)} MB.",
        )

    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    if ext == ".pdf":
        if not content.startswith(PDF_MAGIC):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="The uploaded file does not appear to be a valid PDF.",
            )
    elif ext == ".docx":
        if not _is_valid_docx(content):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="The uploaded file does not appear to be a valid DOCX document.",
            )

    return content, ext


# Kept for backward compatibility with any existing callers/tests that only
# ever dealt with PDFs; delegates to the combined validator.
async def validate_pdf_upload(file: UploadFile) -> bytes:
    content, ext = await validate_resume_upload(file)
    if ext != ".pdf":
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PDF files are accepted.",
        )
    return content


def generate_storage_key(user_id: str, extension: str = ".pdf") -> str:
    """
    Generate a random storage key. The original filename is NEVER used in storage paths
    to prevent path traversal and to avoid leaking user data in storage backends.
    """
    rand = secrets.token_hex(24)
    safe_ext = extension if extension in ALLOWED_EXTENSIONS else ".pdf"
    return f"resumes/{user_id}/{rand}{safe_ext}"


def compute_file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def sanitize_display_filename(original: str) -> str:
    """
    Return a safe display name (shown in the UI only, never used in storage).
    Strips path separators and dangerous characters.
    """
    # Take only the basename
    name = os.path.basename(original)
    # Allow only alphanumeric, dots, underscores, hyphens, spaces
    name = re.sub(r"[^\w\s.\-]", "", name, flags=re.ASCII)
    return name[:MAX_FILENAME_LEN] or "resume.pdf"
