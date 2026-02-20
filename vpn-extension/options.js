const STORAGE_KEY = "vpnConfigs";

const fileInput = document.getElementById("fileInput");
const saveJsonBtn = document.getElementById("saveJsonBtn");
const configJson = document.getElementById("configJson");
const statusEl = document.getElementById("status");
const tbody = document.getElementById("configsTbody");

fileInput.addEventListener("change", onFileSelected);
saveJsonBtn.addEventListener("click", onSaveJson);

render();

async function onFileSelected(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const text = await file.text();
  try {
    const config = JSON.parse(text);
    await saveConfig(config);
    fileInput.value = "";
  } catch (err) {
    setStatus(`Invalid JSON file: ${String(err)}`);
  }
}

async function onSaveJson() {
  try {
    const config = JSON.parse(configJson.value);
    await saveConfig(config);
    configJson.value = "";
  } catch (err) {
    setStatus(`Invalid JSON: ${String(err)}`);
  }
}

async function saveConfig(config) {
  validateConfig(config);
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  const items = data[STORAGE_KEY] || [];

  const normalized = {
    id: crypto.randomUUID(),
    name: config.name,
    scheme: config.scheme || "http",
    host: config.host,
    port: Number(config.port),
    bypassList: Array.isArray(config.bypassList) ? config.bypassList : ["localhost", "127.0.0.1"]
  };

  items.push(normalized);
  await chrome.storage.local.set({ [STORAGE_KEY]: items });
  setStatus(`Saved config: ${normalized.name}`);
  await render();
}

function validateConfig(config) {
  if (!config || typeof config !== "object") {
    throw new Error("Config must be an object.");
  }
  if (!config.name || !config.host || !config.port) {
    throw new Error("Required fields: name, host, port.");
  }
}

async function deleteConfig(id) {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  const items = (data[STORAGE_KEY] || []).filter((x) => x.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: items });
  setStatus("Config deleted.");
  await render();
}

async function render() {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  const items = data[STORAGE_KEY] || [];

  tbody.innerHTML = "";

  if (!items.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.textContent = "No configs yet.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  for (const cfg of items) {
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.textContent = cfg.name;

    const endpointTd = document.createElement("td");
    endpointTd.textContent = `${cfg.scheme}://${cfg.host}:${cfg.port}`;

    const actionsTd = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "inline-btn";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => deleteConfig(cfg.id));
    actionsTd.appendChild(delBtn);

    tr.appendChild(nameTd);
    tr.appendChild(endpointTd);
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  }
}

function setStatus(message) {
  statusEl.textContent = message;
}
