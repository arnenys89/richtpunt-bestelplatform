-- Zet de eerder toegevoegde DAN-code om naar EAN-13 en dwing uniciteit af.
ALTER TABLE catalog_items RENAME COLUMN dan_code TO ean_code;
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_items_ean_code
ON catalog_items(ean_code)
WHERE ean_code IS NOT NULL AND ean_code <> '';
