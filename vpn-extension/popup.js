const STORAGE_KEY = "vpnConfigs";
const ACTIVE_CONFIG_KEY = "activeVpnConfigId";

const configSelect = document.getElementById("configSelect");
const statusEl = document.getElementById("status");

document.getElementById("connectBtn").addEventListener("click", onConnect);
document.getElementById("disconnectBtn").addEventListener("click", onDisconnect);
document.getElementById("openOptionsBtn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

init();

async function init() {
  const data = await chrome.storage.local.get([STORAGE_KEY, ACTIVE_CONFIG_KEY]);
  const configs = data[STORAGE_KEY] || [];
  const activeId = data[ACTIVE_CONFIG_KEY];

  configSelect.innerHTML = "";

  if (!configs.length) {
    const option = document.createElement("option");
    option.textContent = "No configs found";
    option.value = "";
    configSelect.appendChild(option);
    configSelect.disabled = true;
    setStatus("Add config files in options.");
    return;
  }

  configSelect.disabled = false;
  for (const cfg of configs) {
    const option = document.createElement("option");
    option.value = cfg.id;
    option.textContent = cfg.name;
    if (cfg.id === activeId) {
      option.selected = true;
    }
    configSelect.appendChild(option);
  }

  if (activeId) {
    setStatus(`Active: ${configs.find((c) => c.id === activeId)?.name || "unknown"}`);
  } else {
    setStatus("Not connected.");
  }
}

async function onConnect() {
  const configId = configSelect.value;
  if (!configId) {
    setStatus("Select a config.");
    return;
  }

  const data = await chrome.storage.local.get([STORAGE_KEY]);
  const cfg = (data[STORAGE_KEY] || []).find((item) => item.id === configId);
  if (!cfg) {
    setStatus("Config not found.");
    return;
  }

  chrome.runtime.sendMessage({ type: "APPLY_CONFIG", payload: cfg }, (response) => {
    if (!response?.ok) {
      setStatus(`Error: ${response?.error || "Failed to connect"}`);
      return;
    }
    setStatus(`Connected: ${cfg.name}`);
  });
}

function onDisconnect() {
  chrome.runtime.sendMessage({ type: "DISCONNECT_VPN" }, (response) => {
    if (!response?.ok) {
      setStatus(`Error: ${response?.error || "Failed to disconnect"}`);
      return;
    }
    setStatus("Disconnected.");
  });
}

function setStatus(msg) {
  statusEl.textContent = msg;
}
