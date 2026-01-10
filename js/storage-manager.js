// storage-manager.js - Unified storage for Chrome extension and web app
// This file replaces chrome.storage.local calls with localStorage for web compatibility

const StorageManager = {
    // Check if we're in Chrome extension environment
    isChromeExtension: () => {
        return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    },

    // Set data
    set: (data) => {
        return new Promise((resolve, reject) => {
            if (StorageManager.isChromeExtension()) {
                chrome.storage.local.set(data, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            } else {
                // Web environment - use localStorage
                try {
                    Object.keys(data).forEach(key => {
                        localStorage.setItem(key, JSON.stringify(data[key]));
                    });
                    resolve();
                } catch (error) {
                    reject(error);
                }
            }
        });
    },

    // Get data
    get: (keys) => {
        return new Promise((resolve, reject) => {
            if (StorageManager.isChromeExtension()) {
                chrome.storage.local.get(keys, (result) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(result);
                    }
                });
            } else {
                // Web environment - use localStorage
                try {
                    const result = {};
                    
                    if (Array.isArray(keys)) {
                        keys.forEach(key => {
                            const item = localStorage.getItem(key);
                            result[key] = item ? JSON.parse(item) : null;
                        });
                    } else if (typeof keys === 'string') {
                        const item = localStorage.getItem(keys);
                        result[keys] = item ? JSON.parse(item) : null;
                    } else if (typeof keys === 'object') {
                        // Handle object with default values
                        Object.keys(keys).forEach(key => {
                            const item = localStorage.getItem(key);
                            result[key] = item ? JSON.parse(item) : keys[key];
                        });
                    } else {
                        // Get everything
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            try {
                                result[key] = JSON.parse(localStorage.getItem(key));
                            } catch {
                                result[key] = localStorage.getItem(key);
                            }
                        }
                    }
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            }
        });
    },

    // Remove data
    remove: (keys) => {
        return new Promise((resolve, reject) => {
            if (StorageManager.isChromeExtension()) {
                chrome.storage.local.remove(keys, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            } else {
                // Web environment - use localStorage
                try {
                    if (Array.isArray(keys)) {
                        keys.forEach(key => localStorage.removeItem(key));
                    } else {
                        localStorage.removeItem(keys);
                    }
                    resolve();
                } catch (error) {
                    reject(error);
                }
            }
        });
    },

    // Clear all data
    clear: () => {
        return new Promise((resolve, reject) => {
            if (StorageManager.isChromeExtension()) {
                chrome.storage.local.clear(() => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            } else {
                // Web environment - use localStorage
                try {
                    localStorage.clear();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            }
        });
    },

    // Get storage usage info
    getBytesInUse: (keys) => {
        return new Promise((resolve) => {
            if (StorageManager.isChromeExtension()) {
                chrome.storage.local.getBytesInUse(keys, (bytes) => {
                    resolve(bytes);
                });
            } else {
                // Estimate for web
                let total = 0;
                if (keys && Array.isArray(keys)) {
                    keys.forEach(key => {
                        const item = localStorage.getItem(key);
                        if (item) total += new Blob([item]).size;
                    });
                } else {
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        const item = localStorage.getItem(key);
                        if (item) total += new Blob([item]).size;
                    }
                }
                resolve(total);
            }
        });
    }
};

// Make it available globally
window.StorageManager = StorageManager;