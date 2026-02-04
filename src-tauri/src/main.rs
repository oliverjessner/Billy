#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod models;
mod services;
mod utils;

use anyhow::anyhow;
use tauri::Manager;

use crate::models::Settings;
use crate::services::state::AppState;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| anyhow!("App data dir: {}", e))?;
            std::fs::create_dir_all(&app_data_dir)?;

            let db_path = app_data_dir.join("billly.sqlite");
            let db = db::Database::new(db_path)?;
            let settings = load_settings(&db);

            let state = AppState::new(db, settings);
            state.restart_watchers(app.handle())?;
            state.enqueue_scan(app.handle())?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::settings::test_openai_key,
            commands::settings::reprocess_all,
            commands::settings::pick_folder,
            commands::dashboard::get_dashboard_stats,
            commands::invoices::get_invoices,
            commands::invoices::get_invoice_detail,
            commands::invoices::update_invoice_field,
            commands::invoices::clear_overrides,
            commands::invoices::clear_override,
            commands::invoices::reprocess_invoice,
            commands::invoices::open_invoice_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn load_settings(db: &db::Database) -> Settings {
    let revenue_folder = db.get_setting("revenue_folder").ok().flatten();
    let payable_folder = db.get_setting("payable_folder").ok().flatten();
    let openai_api_key = db.get_setting("openai_api_key").ok().flatten();
    let ocr_language = db
        .get_setting("ocr_language")
        .ok()
        .flatten()
        .unwrap_or_else(|| "deu".to_string());
    Settings {
        revenue_folder,
        payable_folder,
        openai_api_key,
        ocr_language,
    }
}
