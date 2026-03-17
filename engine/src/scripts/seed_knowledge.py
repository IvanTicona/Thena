"""
Seed script for institutional knowledge base.

Parses the UPB guide PDF and any other institutional documents,
chunks them, generates embeddings, and stores in pgvector.

Usage:
    python -m src.scripts.seed_knowledge [--file path/to/file.pdf] [--reset]

If no --file is provided, seeds the default UPB guide from docs/.
"""

import argparse
import logging
import os
import sys

from sqlalchemy import create_engine

from src.config import settings
from src.application.parsers.pdf_parser import parse_pdf
from src.application.parsers.docx_parser import parse_docx
from src.application.pipelines.chunker import chunk_text
from src.application.pipelines.embedding import embed_and_store, delete_by_source

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_DOCS = [
    {
        "path": "docs/PROYECTO DE GRADO 2026.pdf",
        "name": "PROYECTO DE GRADO 2026.pdf",
    },
]


def seed_file(db_engine, file_path: str, source_name: str, reset: bool = False):
    """Parse, chunk, embed, and store a single file."""
    logger.info("Processing: %s", file_path)

    if not os.path.exists(file_path):
        logger.error("File not found: %s", file_path)
        return

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        parsed = parse_pdf(file_bytes)
        sections = parsed.sections
    elif ext == ".docx":
        parsed = parse_docx(file_bytes)
        sections = [
            {
                "heading": s.heading,
                "level": s.level,
                "content": s.content,
                "offset_start": s.offset_start,
                "offset_end": s.offset_end,
            }
            for s in parsed.sections
        ]
    else:
        logger.error("Unsupported file type: %s", ext)
        return

    if reset:
        delete_by_source(db_engine, source_name)

    chunks = chunk_text(parsed.full_text if hasattr(parsed, 'full_text') else "", sections=sections)
    logger.info("Created %d chunks from %s", len(chunks), source_name)

    embed_and_store(
        db_engine=db_engine,
        chunks=chunks,
        layer="INSTITUTIONAL",
        source_document=source_name,
        owner_id=None,
    )

    logger.info("Seeded %d chunks for %s", len(chunks), source_name)


def main():
    parser = argparse.ArgumentParser(description="Seed institutional knowledge base")
    parser.add_argument("--file", type=str, help="Path to a specific file to seed")
    parser.add_argument("--name", type=str, help="Source document name (defaults to filename)")
    parser.add_argument("--reset", action="store_true", help="Delete existing chunks before seeding")
    args = parser.parse_args()

    db_engine = create_engine(settings.DATABASE_URL)

    if args.file:
        source_name = args.name or os.path.basename(args.file)
        seed_file(db_engine, args.file, source_name, reset=args.reset)
    else:
        # Seed default institutional documents
        for doc in DEFAULT_DOCS:
            seed_file(db_engine, doc["path"], doc["name"], reset=args.reset)

    db_engine.dispose()
    logger.info("Knowledge seeding complete.")


if __name__ == "__main__":
    main()
