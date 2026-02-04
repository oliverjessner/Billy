import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import Chart from "chart.js/auto";

const state = {
  currentView: "dashboard",
  currentCategory: "revenue",
  selectedInvoiceId: null,
  charts: {
    monthly: null,
    profit: null
  }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function setStatus(text, ok = true) {
  const indicator = $("#status-indicator");
  indicator.querySelector(".text").textContent = text;
  indicator.querySelector(".dot").style.background = ok ? "var(--ok)" : "var(--danger)";
}

function formatCurrency(value) {
  const amount = typeof value === "number" ? value : Number.parseFloat(value || "0");
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2
  }).format(amount);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function setActiveView(view) {
  state.currentView = view;
  $$(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  $$(".view").forEach((section) => section.classList.toggle("active", section.id === `view-${view}`));
}

async function loadDashboard() {
  const monthValue = $("#month-select").value;
  const stats = await invoke("get_dashboard_stats", { yearMonth: monthValue || null });
  renderKpis(stats);
  renderRecent("#recent-revenue", stats.recent_revenue);
  renderRecent("#recent-payables", stats.recent_payables);
  $("#open-payables").textContent = formatCurrency(stats.open_payables);
  renderCharts(stats);
}

function renderKpis(stats) {
  const kpis = [
    { label: "Revenue (Month)", value: formatCurrency(stats.revenue_month) },
    { label: "Revenue (Year)", value: formatCurrency(stats.revenue_year) },
    { label: "Payables (Month)", value: formatCurrency(stats.payable_month) },
    { label: "Payables (Year)", value: formatCurrency(stats.payable_year) },
    { label: "Profit (Month)", value: formatCurrency(stats.profit_month) },
    { label: "Profit (Year)", value: formatCurrency(stats.profit_year) }
  ];

  const container = $("#kpi-grid");
  container.innerHTML = "";
  kpis.forEach((kpi) => {
    const card = document.createElement("div");
    card.className = "kpi";
    card.innerHTML = `<div class="label">${kpi.label}</div><div class="value">${kpi.value}</div>`;
    container.appendChild(card);
  });
}

function renderRecent(selector, items) {
  const list = $(selector);
  list.innerHTML = "";
  if (!items.length) {
    list.innerHTML = "<li class=\"muted\">No data</li>";
    return;
  }
  items.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${item.counterparty_name || "Unknown"}</span><span>${formatCurrency(item.total_amount)}</span>`;
    list.appendChild(li);
  });
}

function renderCharts(stats) {
  if (!state.charts.monthly) {
    state.charts.monthly = new Chart($("#chart-monthly"), {
      type: "line",
      data: {
        labels: stats.chart_months,
        datasets: [
          {
            label: "Revenue",
            data: stats.chart_revenue,
            borderColor: "#22c55e",
            backgroundColor: "rgba(34,197,94,0.2)",
            tension: 0.3
          },
          {
            label: "Payables",
            data: stats.chart_payables,
            borderColor: "#ef4444",
            backgroundColor: "rgba(239,68,68,0.2)",
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: "#f3f4f6" } }
        },
        scales: {
          x: { ticks: { color: "#9aa3b2" }, grid: { color: "rgba(255,255,255,0.05)" } },
          y: { ticks: { color: "#9aa3b2" }, grid: { color: "rgba(255,255,255,0.05)" } }
        }
      }
    });
  } else {
    state.charts.monthly.data.labels = stats.chart_months;
    state.charts.monthly.data.datasets[0].data = stats.chart_revenue;
    state.charts.monthly.data.datasets[1].data = stats.chart_payables;
    state.charts.monthly.update();
  }

  if (!state.charts.profit) {
    state.charts.profit = new Chart($("#chart-profit"), {
      type: "bar",
      data: {
        labels: stats.chart_months,
        datasets: [
          {
            label: "Profit",
            data: stats.chart_profit,
            backgroundColor: "rgba(217,70,239,0.6)"
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: "#f3f4f6" } }
        },
        scales: {
          x: { ticks: { color: "#9aa3b2" }, grid: { color: "rgba(255,255,255,0.05)" } },
          y: { ticks: { color: "#9aa3b2" }, grid: { color: "rgba(255,255,255,0.05)" } }
        }
      }
    });
  } else {
    state.charts.profit.data.labels = stats.chart_months;
    state.charts.profit.data.datasets[0].data = stats.chart_profit;
    state.charts.profit.update();
  }
}

async function loadInvoices() {
  const list = await invoke("get_invoices", { category: state.currentCategory });
  renderInvoiceList(list);
}

function renderInvoiceList(items) {
  const tbody = $("#invoice-list");
  tbody.innerHTML = "";
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">No invoices</td></tr>`;
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.invoice_date || "-"}</td>
      <td>${item.counterparty_name || "Unknown"}</td>
      <td>${formatCurrency(item.total_amount)}</td>
      <td>${item.status}</td>
      <td>${item.file_path ? item.file_path.split("/").pop() : "-"}</td>
      <td>${Math.round((item.confidence_score || 0) * 100)}%</td>
    `;
    row.addEventListener("click", () => selectInvoice(item.id));
    tbody.appendChild(row);
  });
}

async function selectInvoice(id) {
  state.selectedInvoiceId = id;
  const detail = await invoke("get_invoice_detail", { invoiceId: id });
  renderInvoiceDetail(detail);
}

function renderInvoiceDetail(detail) {
  const container = $("#detail-body");
  const invoice = detail.invoice;
  const fields = [
    ["invoice_number", "Invoice Number"],
    ["invoice_date", "Invoice Date"],
    ["due_date", "Due Date"],
    ["counterparty_name", "Company"],
    ["total_amount", "Total Amount"],
    ["currency", "Currency"],
    ["tax_amount", "Tax"],
    ["net_amount", "Net Amount"],
    ["status", "Status"],
    ["paid_at", "Paid At"]
  ];

  container.innerHTML = "";
  fields.forEach(([key, label]) => {
    const row = document.createElement("div");
    row.className = "detail-row";
    row.innerHTML = `
      <span>${label}</span>
      <div class="detail-value">
        <input data-field="${key}" value="${invoice[key] ?? ""}" />
        <button class="ghost" data-clear="${key}">Clear override</button>
      </div>
    `;
    container.appendChild(row);
  });

  const ocrBlock = document.createElement("div");
  ocrBlock.className = "detail-block";
  ocrBlock.innerHTML = `
    <h4>OCR / Extracted Text</h4>
    <pre>${escapeHtml(invoice.ocr_text || "No text stored")}<\/pre>
  `;
  container.appendChild(ocrBlock);

  const jsonBlock = document.createElement("div");
  jsonBlock.className = "detail-block";
  jsonBlock.innerHTML = `
    <h4>Extracted JSON</h4>
    <pre>${escapeHtml(invoice.extracted_json || "{}")}<\/pre>
  `;
  container.appendChild(jsonBlock);

  container.querySelectorAll("input[data-field]").forEach((input) => {
    input.addEventListener("change", async (event) => {
      const field = event.target.dataset.field;
      await invoke("update_invoice_field", {
        payload: {
          invoiceId: invoice.id,
          fieldName: field,
          value: event.target.value
        }
      });
      await loadInvoices();
      await loadDashboard();
    });
  });

  container.querySelectorAll("button[data-clear]").forEach((button) => {
    button.addEventListener("click", async () => {
      const field = button.dataset.clear;
      await invoke("clear_override", {
        invoiceId: invoice.id,
        fieldName: field
      });
      await selectInvoice(invoice.id);
      await loadInvoices();
      await loadDashboard();
    });
  });
}

async function loadSettings() {
  const settings = await invoke("get_settings");
  $("#revenue-folder").value = settings.revenue_folder || "";
  $("#payable-folder").value = settings.payable_folder || "";
  $("#openai-key").value = "";
  $("#ocr-language").value = settings.ocr_language || "deu";
}

async function saveSettings() {
  const payload = {
    revenueFolder: $("#revenue-folder").value || null,
    payableFolder: $("#payable-folder").value || null,
    openaiApiKey: $("#openai-key").value || null,
    ocrLanguage: $("#ocr-language").value
  };
  await invoke("save_settings", { payload });
  await loadDashboard();
  await loadInvoices();
}

async function init() {
  const monthInput = $("#month-select");
  const now = new Date();
  monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  $("#refresh-dashboard").addEventListener("click", loadDashboard);
  monthInput.addEventListener("change", loadDashboard);

  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => setActiveView(tab.dataset.view));
  });

  $$(".segment").forEach((segment) => {
    segment.addEventListener("click", async () => {
      $$(".segment").forEach((s) => s.classList.remove("active"));
      segment.classList.add("active");
      state.currentCategory = segment.dataset.category;
      await loadInvoices();
    });
  });

  $("#pick-revenue-folder").addEventListener("click", async () => {
    const selected = await invoke("pick_folder");
    if (selected) {
      $("#revenue-folder").value = selected;
    }
  });

  $("#pick-payable-folder").addEventListener("click", async () => {
    const selected = await invoke("pick_folder");
    if (selected) {
      $("#payable-folder").value = selected;
    }
  });

  $("#save-settings").addEventListener("click", saveSettings);
  $("#test-openai").addEventListener("click", async () => {
    const key = $("#openai-key").value;
    if (!key) return;
    const ok = await invoke("test_openai_key", { apiKey: key });
    setStatus(ok ? "OpenAI key valid" : "OpenAI key invalid", ok);
  });

  $("#reprocess-all").addEventListener("click", async () => {
    await invoke("reprocess_all");
    setStatus("Reprocessing started", true);
  });

  $("#reprocess-visible").addEventListener("click", async () => {
    await invoke("reprocess_all");
    setStatus("Reprocessing started", true);
  });

  $("#reprocess-single").addEventListener("click", async () => {
    if (!state.selectedInvoiceId) return;
    await invoke("reprocess_invoice", { invoiceId: state.selectedInvoiceId });
    setStatus("Invoice reprocessed", true);
  });

  $("#open-pdf").addEventListener("click", async () => {
    if (!state.selectedInvoiceId) return;
    const detail = await invoke("get_invoice_detail", { invoiceId: state.selectedInvoiceId });
    if (detail.invoice.file_path) {
      await invoke("open_invoice_file", { path: detail.invoice.file_path });
    }
  });

  await loadSettings();
  await loadDashboard();
  await loadInvoices();

  await listen("invoice-updated", async () => {
    await loadDashboard();
    await loadInvoices();
  });
  await listen("processing-error", (event) => {
    setStatus(`Error: ${event.payload}`, false);
  });
}

init().catch((err) => {
  console.error(err);
  setStatus("Startup error", false);
});
