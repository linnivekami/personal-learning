"""Bounded Office/PDF conversion; no database or model credentials in this container."""
import asyncio
import base64
import hmac
import os
import tempfile
import zipfile
import re
from xml.etree import ElementTree
from pathlib import Path
from urllib.parse import urlparse
import fitz
import httpx
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile

app = FastAPI(docs_url=None, redoc_url=None)
semaphore = asyncio.Semaphore(1)
MAX_BYTES = 20 * 1024 * 1024


def validate_office(path: Path) -> None:
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        if len(entries) > 4000 or sum(e.file_size for e in entries) > 150 * 1024 * 1024:
            raise ValueError("Office archive expansion exceeds limit")
        for entry in entries:
            if entry.filename.startswith("/") or ".." in Path(entry.filename).parts:
                raise ValueError("Unsafe Office archive path")
            if entry.filename.lower().endswith(("vbaproject.bin", ".exe", ".dll")):
                raise ValueError("Macros and executables are not accepted")
            if "/embeddings/" in entry.filename.lower():
                raise ValueError("Embedded executable/OLE objects are not accepted")
            if entry.filename.endswith(".rels"):
                if entry.file_size > 2 * 1024 * 1024:
                    raise ValueError("Relationship metadata exceeds limit")
                relationships = ElementTree.fromstring(archive.read(entry))
                if any(r.attrib.get("TargetMode", "").lower() == "external" for r in relationships):
                    raise ValueError("External Office relationships must be removed before import")


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/convert")
async def convert(file: UploadFile = File(...), callback: str = Form(...), jobId: str = Form(...), callbackToken: str = Form(...), authorization: str = Header(default="")):
    expected = os.environ.get("CONVERTER_TOKEN", "")
    if not expected or not hmac.compare_digest(authorization, "Bearer " + expected):
        raise HTTPException(403, "Unauthorized")
    parsed = urlparse(callback)
    allowed = os.environ.get("APP_ORIGIN", "")
    if not allowed or f"{parsed.scheme}://{parsed.netloc}" != allowed.rstrip("/") or not parsed.path.startswith("/internal/materials/") or parsed.query or parsed.fragment:
        raise HTTPException(400, "Invalid callback origin")
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".pdf", ".docx", ".pptx"}:
        raise HTTPException(415, "Unsupported file type")
    async with semaphore:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / ("source" + suffix)
            total = 0
            with source.open("wb") as out:
                while chunk := await file.read(1024 * 1024):
                    total += len(chunk)
                    if total > MAX_BYTES:
                        raise HTTPException(413, "File exceeds 20MB")
                    out.write(chunk)
            try:
                if suffix != ".pdf":
                    validate_office(source)
                    profile = Path(directory) / "profile"
                    process = await asyncio.create_subprocess_exec(
                        "libreoffice", "--headless", "--nologo", "--nodefault", "--norestore", "--nofirststartwizard",
                        f"-env:UserInstallation={profile.as_uri()}", "--convert-to", "pdf", "--outdir", directory, str(source),
                        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                    )
                    try:
                        await asyncio.wait_for(process.communicate(), 90)
                    except asyncio.TimeoutError:
                        process.kill()
                        await process.wait()
                        raise ValueError("Office conversion timed out")
                    if process.returncode != 0:
                        raise ValueError("Office conversion failed")
                pdf = source if suffix == ".pdf" else Path(directory) / "source.pdf"
                if not pdf.exists() or pdf.stat().st_size > 30 * 1024 * 1024:
                    raise ValueError("Converted document missing or too large")
                document = fitz.open(pdf)
                if document.is_encrypted or not 1 <= len(document) <= 100:
                    raise ValueError("Encrypted documents or more than 100 pages are not accepted")
                headers = {"Authorization": "Bearer " + callbackToken, "X-Job-ID": jobId}
                async with httpx.AsyncClient(timeout=45, follow_redirects=False) as client:
                    with pdf.open("rb") as handle:
                        response = await client.put(callback + "/pdf", headers=headers, content=handle.read())
                        response.raise_for_status()
                    for number, page in enumerate(document, 1):
                        text = page.get_text(sort=True)
                        graphics = bool(page.get_images() or page.get_drawings() or re.search(r"[∑∫√≤≥∂∞�]", text) or any(re.search(r"math|symbol", str(font), re.I) for font in page.get_fonts()))
                        image = None
                        if len(text.strip()) < 40 or graphics:
                            pixmap = page.get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False)
                            image_bytes = pixmap.tobytes("png")
                            if len(image_bytes) > 2 * 1024 * 1024:
                                pixmap = page.get_pixmap(matrix=fitz.Matrix(0.65, 0.65), alpha=False)
                                image_bytes = pixmap.tobytes("png")
                            image = base64.b64encode(image_bytes).decode()
                        response = await client.post(callback + "/page", headers=headers, json={"pages": len(document), "page": number, "text": text[:50000], "image": image, "hasGraphics": graphics})
                        response.raise_for_status()
                    response = await client.post(callback + "/complete", headers=headers, json={"pages": len(document), "complete": True})
                    response.raise_for_status()
                document.close()
                return {"ok": True}
            except (ValueError, zipfile.BadZipFile) as error:
                raise HTTPException(422, str(error)) from error
