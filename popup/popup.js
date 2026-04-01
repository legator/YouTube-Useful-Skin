/* popup.js — handles the enable/disable toggle for the skin */
(function () {
  const toggle = document.getElementById('skinToggle');

  // Load saved state
  chrome.storage?.local?.get(['skinEnabled'], (result) => {
    // Default to enabled
    const enabled = result.skinEnabled !== undefined ? result.skinEnabled : true;
    toggle.checked = enabled;
  });

  toggle.addEventListener('change', () => {
    const enabled = toggle.checked;
    chrome.storage?.local?.set({ skinEnabled: enabled });

    // Send message to active YouTube tab to toggle immediately
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleSkin', enabled });
      }
    });
  });
})();
