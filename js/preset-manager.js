// preset-manager.js - Medicine preset management (Web Compatible)

// ====== MEDICINE PRESET FUNCTIONS ======
function initMedicinePresets() {
    return new Promise(async (resolve) => {
        try {
            const result = await StorageManager.get(['medicinePresets']);
            medicinePresets = result.medicinePresets || [];
            updatePresetDropdown();
            resolve();
        } catch (error) {
            console.error('Error loading medicine presets:', error);
            medicinePresets = [];
            updatePresetDropdown();
            resolve();
        }
    });
}

function updatePresetDropdown() {
    const dropdown = document.getElementById('loadPresetDropdown');
    
    // SAVE current selection before clearing
    const selectedIndex = dropdown.value;
    
    // Clear existing options except the first one
    while (dropdown.options.length > 1) {
        dropdown.remove(1);
    }
    
    if (medicinePresets && medicinePresets.length > 0) {
        medicinePresets.forEach((preset, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = preset.name;
            dropdown.appendChild(option);
        });
        dropdown.disabled = false;
        
        // RESTORE selection if it's still valid
        if (selectedIndex !== "" && selectedIndex < medicinePresets.length) {
            dropdown.value = selectedIndex;
        }
    } else {
        dropdown.disabled = true;
    }
    
    updateSavePresetButtonState();
    updatePresetStats();
}

function updateSavePresetButtonState() {
    const savePresetBtn = document.getElementById('savePresetBtn');
    if (!savePresetBtn) return;

    const rows = document.querySelectorAll('.med-row');
    
    // Check if there are medicines to save
    let hasMedicines = false;
    rows.forEach(row => {
        const name = row.querySelector('.mName').value.trim();
        if (name) hasMedicines = true;
    });
    
    if (hasMedicines) {
        savePresetBtn.disabled = false;
        savePresetBtn.classList.remove('btn-disabled');
    } else {
        savePresetBtn.disabled = true;
        savePresetBtn.classList.add('btn-disabled');
    }
}

function saveMedicinePreset() {
    // Collect current medicines
    const medicines = [];
    document.querySelectorAll('.med-row').forEach(row => {
        const name = row.querySelector('.mName').value.trim();
        if (name) {
            medicines.push({
                name: name,
                qty: row.querySelector('.mQty').value,
                unit: row.querySelector('.mUnit').value,
                dose: row.querySelector('.mDose').value,
                freq: row.querySelector('.mFreq').value,
                days: row.querySelector('.mDays').value,
                meal: row.querySelector('.mMeal').value,
                inst: row.querySelector('.mInst').value
            });
        }
    });
    
    if (medicines.length === 0) {
        showCustomAlert('No Medicines', 'Please add at least one medicine to save as a preset.', 'simple');
        return;
    }
    
    // Store medicines temporarily
    window.tempPresetMedicines = medicines;
    
    // Open preset name input modal
    openPresetModal();
}

function openPresetModal() {
    document.getElementById('presetModal').style.display = 'flex';
    document.getElementById('presetNameInput').value = '';
    document.getElementById('presetNameInput').focus();
}

function closePresetModal() {
    document.getElementById('presetModal').style.display = 'none';
    if (presetReject) {
        presetReject();
        presetResolve = null;
        presetReject = null;
    }
}

function confirmSavePreset() {
    const presetName = document.getElementById('presetNameInput').value.trim();
    
    if (!presetName) {
        showCustomAlert('Preset Name Required', 'Please enter a name for this preset.', 'simple');
        return;
    }
    
    // Check if preset name already exists
    const existingPreset = medicinePresets.find(p => p.name.toLowerCase() === presetName.toLowerCase());
    if (existingPreset) {
        showCustomAlert('Duplicate Preset', `A preset named "${presetName}" already exists. Please use a different name.`, 'simple');
        return;
    }
    
    // Save the preset
    const newPreset = {
        name: presetName,
        medicines: window.tempPresetMedicines,
        created: new Date().toISOString(),
        count: window.tempPresetMedicines.length
    };
    
    medicinePresets.unshift(newPreset); // Add to beginning
    
    StorageManager.set({ medicinePresets: medicinePresets }).then(() => {
        updatePresetDropdown();
        closePresetModal();
        showSuccessMessage('Preset Saved', `Preset "${presetName}" has been saved successfully.`);
        delete window.tempPresetMedicines;
    }).catch(error => {
        console.error('Error saving preset:', error);
        showCustomAlert('Error', 'Failed to save preset.', 'error');
    });
    
    resetForm();
}

function loadPreset(index, silent = false) {
    const preset = medicinePresets[index];
    if (!preset) return;

    updateSavePresetButtonState();
    
    // 1. Show the medicine table section (Active Mode)
    // This mimics the "Add Prescription" or "New Prescription" button behavior
    const medTableSection = document.getElementById('medicineTableSection');
    if (medTableSection) {
        medTableSection.style.display = 'block';
    }

    const medBody = document.getElementById('medBody');
    if (medBody) {
        medBody.innerHTML = ''; 
    }

    // 2. Populate rows
    if (preset.medicines && Array.isArray(preset.medicines)) {
        preset.medicines.forEach(medicine => {
            addMedicineRow(medicine);
        });
    }

    // 3. Sync UI
    const dropdown = document.getElementById('loadPresetDropdown');
    if (dropdown) dropdown.value = index;

    // 4. Force "Save as Preset" to be unclickable immediately after loading
    const savePresetBtn = document.getElementById('savePresetBtn');
    if (savePresetBtn) {
        savePresetBtn.disabled = true;
        savePresetBtn.classList.add('btn-disabled');
    }

    if (!silent) showSuccessMessage('Preset Loaded', `Loaded "${preset.name}".`);
    closePresetManagementModal();
}

function openPresetManagementModal() {
    document.getElementById('presetManagementModal').style.display = 'flex';
    loadPresetManagementList();
}

function closePresetManagementModal() {
    document.getElementById('presetManagementModal').style.display = 'none';
}

function loadPresetManagementList() {
    const list = document.getElementById('presetList');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (!medicinePresets || medicinePresets.length === 0) {
        list.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No saved presets found.</div>';
        return;
    }
    
    medicinePresets.forEach((preset, index) => {
        const item = document.createElement('div');
        item.className = 'preset-list-item';
        item.innerHTML = `
            <div class="preset-info-container" style="flex-grow: 1;">
                <div class="preset-name">${preset.name}</div>
                <div class="preset-count">${preset.medicines.length} medicine(s)</div>
            </div>
            <div class="preset-actions" style="display: flex; gap: 8px;">
                <button class="btn-load-small" data-index="${index}">Load</button>
                <button class="preset-remove-btn" data-index="${index}" title="Remove Preset">×</button>
            </div>
        `;
        
        // Explicit Load button listener
        item.querySelector('.btn-load-small').addEventListener('click', () => {
            loadPreset(index);
        });
        
        // Remove preset listener
        item.querySelector('.preset-remove-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            removePreset(index);
        });
        
        list.appendChild(item);
    });
}

function removePreset(index) {
    showCustomAlert('Remove Preset', `Are you sure you want to remove the preset "${medicinePresets[index].name}"?`, 'warning').then(async (confirmed) => {
        if (confirmed) {
            medicinePresets.splice(index, 1);
            try {
                await StorageManager.set({ medicinePresets: medicinePresets });
                updatePresetDropdown();
                loadPresetManagementList();
                showSuccessMessage('Preset Removed', 'Preset has been removed successfully.');
            } catch (error) {
                console.error('Error removing preset:', error);
                showCustomAlert('Error', 'Failed to remove preset.', 'error');
            }
        }
    });
}

function updatePresetStats() {
    const totalMedicines = medicinePresets ? medicinePresets.reduce((sum, preset) => sum + preset.medicines.length, 0) : 0;
    document.getElementById('presetCount').textContent = medicinePresets ? medicinePresets.length : 0;
    document.getElementById('presetMedicineCount').textContent = totalMedicines;
}