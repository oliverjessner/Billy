CREATE TABLE IF NOT EXISTS processing_logs (
    id TEXT PRIMARY KEY,
    invoice_id TEXT,
    file_hash TEXT,
    process_type TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
);
