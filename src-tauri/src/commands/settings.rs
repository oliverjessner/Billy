use crate::models::Settings;
use crate::services::crypto::CryptoService;
use crate::services::state::AppState;
use serde::Deserialize;
use tauri::{AppHandle, State};

#[derive(Deserialize)]
pub struct SettingsPayload {
    pub revenue_folder: Option<String>,
    pub payable_folder: Option<String>,
    pub openai_api_key: Option<String>,
    pub ocr_language: Option<String>,
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    let db = state.db.lock().map_err(|_| "DB lock".to_string())?;

    let revenue_folder = db.get_setting("revenue_folder").map_err(|e| e.to_string())?;
    let payable_folder = db.get_setting("payable_folder").map_err(|e| e.to_string())?;
    let openai_api_key = db.get_setting("openai_api_key").map_err(|e| e.to_string())?;
    let ocr_language = db
        .get_setting("ocr_language")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "deu".to_string());
    Ok(Settings {
        revenue_folder,
        payable_folder,
        openai_api_key,
        ocr_language,
    })
}

#[tauri::command]
pub async fn save_settings(
    payload: SettingsPayload,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    {
        let db = state.db.lock().map_err(|_| "DB lock".to_string())?;

        if let Some(value) = payload.revenue_folder.clone() {
            db.set_setting("revenue_folder", &value).map_err(|e| e.to_string())?;
        }
        if let Some(value) = payload.payable_folder.clone() {
            db.set_setting("payable_folder", &value).map_err(|e| e.to_string())?;
        }
        if let Some(value) = payload.ocr_language.clone() {
            db.set_setting("ocr_language", &value).map_err(|e| e.to_string())?;
        }
        if let Some(api_key) = payload.openai_api_key.clone() {
            if !api_key.trim().is_empty() {
                let encrypted = CryptoService::encrypt_api_key(&api_key).map_err(|e| e.to_string())?;
                db.set_setting("openai_api_key", &encrypted)
                    .map_err(|e| e.to_string())?;
            }
        }
    }

    let settings = get_settings(state.clone()).await.map_err(|e| e.to_string())?;
    state.update_settings(settings, &app).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn test_openai_key(api_key: String) -> Result<bool, String> {
    let client = reqwest::Client::new();
    let response = client
        .get("https://api.openai.com/v1/models")
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    Ok(response.status().is_success())
}

#[tauri::command]
pub async fn reprocess_all(state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    state.enqueue_scan(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pick_folder() -> Result<Option<String>, String> {
    let selection = rfd::FileDialog::new()
        .pick_folder()
        .map(|path| path.to_string_lossy().to_string());
    Ok(selection)
}
