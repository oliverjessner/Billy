use anyhow::{anyhow, Result};
use std::path::Path;

pub struct TextExtractor;

impl TextExtractor {
    pub fn extract_from_pdf(path: &Path, ocr_language: &str) -> Result<String> {
        if let Ok(text) = pdf_extract::extract_text(path) {
            if !text.trim().is_empty() {
                return Ok(text);
            }
        }
        Self::extract_via_ocr(path, ocr_language)
    }

    fn extract_via_ocr(path: &Path, language: &str) -> Result<String> {
        let text = tesseract::Tesseract::new(None, Some(language))
            .map_err(|e| anyhow!("Tesseract init: {}", e))?
            .set_image(path.to_str().ok_or_else(|| anyhow!("Invalid path"))?)
            .map_err(|e| anyhow!("Tesseract image: {}", e))?
            .recognize()
            .map_err(|e| anyhow!("Tesseract recognize: {}", e))?
            .get_text()
            .map_err(|e| anyhow!("OCR text: {}", e))?;
        Ok(text)
    }

    pub fn validate_text_quality(text: &str) -> bool {
        text.len() > 50 && text.split_whitespace().count() > 10
    }
}
