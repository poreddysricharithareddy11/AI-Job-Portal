"""
Resume text extraction helpers.

This project may be run in environments where some optional dependencies
are not installed (e.g., `PyPDF2`). We therefore lazily import parsers
and fall back to alternatives when possible.
"""

try:
    from PyPDF2 import PdfReader  # type: ignore
except ModuleNotFoundError:
    PdfReader = None

try:
    from docx import Document  # type: ignore
except ModuleNotFoundError:
    Document = None

def extract_text_from_pdf(path):
    try:
        # Preferred: PyPDF2
        if PdfReader is not None:
            reader = PdfReader(path)
            text = ""
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + " "
            return text.strip()

        # Fallback: PyMuPDF (fitz)
        import fitz  # type: ignore
        doc = fitz.open(path)
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text() or "")
        doc.close()
        return " ".join([t.strip() for t in text_parts if t.strip()]).strip()
    except Exception as e:
        print("[ERROR] PDF parse error:", e)
        return ""

def extract_text_from_docx(path):
    try:
        if Document is None:
            return ""
        doc = Document(path)
        return " ".join(p.text for p in doc.paragraphs).strip()
    except Exception as e:
        print("[ERROR] DOCX parse error:", e)
        return ""

def extract_resume_text(path):
    if path.lower().endswith(".pdf"):
        return extract_text_from_pdf(path)
    if path.lower().endswith(".docx"):
        return extract_text_from_docx(path)
    return ""
