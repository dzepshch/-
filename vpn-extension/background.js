const STORAGE_KEY = "vpnConfigs";
const ACTIVE_CONFIG_KEY = "activeVpnConfigId";

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get([STORAGE_KEY, ACTIVE_CONFIG_KEY]);
  if (!Array.isArray(data[STORAGE_KEY])) {
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
  }
  if (!data[ACTIVE_CONFIG_KEY]) {
    await chrome.storage.local.set({ [ACTIVE_CONFIG_KEY]: null });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "APPLY_CONFIG") {
    applyConfig(message.payload)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type === "DISCONNECT_VPN") {
    disconnectProxy()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  return undefined;
});

async function applyConfig(config) {
  if (!config || !config.host || !config.port) {
    throw new Error("Invalid proxy config. Required: host, port.");
  }

  const proxyConfig = {
    mode: "fixed_servers",
    rules: {
      singleProxy: {
        scheme: config.scheme || "http",
        host: config.host,
        port: Number(config.port)
      },
      bypassList: config.bypassList || ["localhost", "127.0.0.1"]
    }
  };

  await chrome.proxy.settings.set({ value: proxyConfig, scope: "regular" });

  if (config.id) {
    await chrome.storage.local.set({ [ACTIVE_CONFIG_KEY]: config.id });
  }
}

async function disconnectProxy() {
  await chrome.proxy.settings.clear({ scope: "regular" });
  await chrome.storage.local.set({ [ACTIVE_CONFIG_KEY]: null });
}
