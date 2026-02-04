CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL CHECK(category IN ('revenue', 'payable')),
    file_path TEXT UNIQUE,
    file_hash TEXT NOT NULL,
    file_modified_at TEXT NOT NULL,
    ingestion_status TEXT NOT NULL DEFAULT 'pending',
    ocr_text TEXT,
    extracted_json TEXT NOT NULL,
    confidence_score REAL NOT NULL DEFAULT 0.0,
    invoice_number TEXT,
    invoice_date TEXT,
    due_date TEXT,
    counterparty_name TEXT,
    total_amount TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    tax_amount TEXT,
    net_amount TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    paid_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_category_date ON invoices(category, invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
