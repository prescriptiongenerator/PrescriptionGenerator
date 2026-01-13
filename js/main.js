// ====== CONSTANTS & GLOBALS ======
const GOOGLE_SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzqerNLzZGi6xxcdKy1VBnsiHqNyaeZyquBW3aRP8oQiRdhfeOtVhZwADKXVFaAvCz_Og/exec';

// Global variables accessible across all modules
let editingMode = null;
let editingIndex = null;
let selectedExportOption = 'local';
let importedFile = null;
let importFileData = null;
let alertResolve = null;
let alertReject = null;
let usedCodes = new Set();
let currentPatientHistory = [];
let selectedPrescriptionIndex = null;
let medicineDatabase = [];
let medicinePresets = [];
let presetResolve = null;
let presetReject = null;

// ====== INITIALIZATION ======
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('App initializing...');
        
        // FIRST: Load current settings to check what we have
        const existingSettings = await StorageManager.get([
            'prescriptionLimit', 
            'prescriptionCount', 
            'isPremium',
            'premiumType',
            'expiryDate',
            'usedCodes'
        ]);
        
        console.log('Existing settings:', existingSettings);
        
        // Check if this is a completely new user (all settings are null/undefined)
        const isNewUser = (
            existingSettings.prescriptionLimit === null && 
            existingSettings.prescriptionLimit === undefined &&
            existingSettings.prescriptionCount === null && 
            existingSettings.prescriptionCount === undefined &&
            existingSettings.isPremium === null && 
            existingSettings.isPremium === undefined
        );
        
        if (isNewUser) {
            console.log('New user detected - setting up trial with 2 free prescriptions');
            await StorageManager.set({
                prescriptionLimit: 2,
                prescriptionCount: 0,
                isPremium: false,
                premiumType: null,
                expiryDate: null,
                usedCodes: [],
                premiumActivatedAt: null
            });
        } else {
            console.log('Existing user detected - preserving settings');
            // For existing users, ensure all required fields exist with proper defaults
            const updatedSettings = {
                prescriptionLimit: existingSettings.prescriptionLimit !== null && existingSettings.prescriptionLimit !== undefined ? existingSettings.prescriptionLimit : 2,
                prescriptionCount: existingSettings.prescriptionCount !== null && existingSettings.prescriptionCount !== undefined ? existingSettings.prescriptionCount : 0,
                isPremium: existingSettings.isPremium !== null && existingSettings.isPremium !== undefined ? existingSettings.isPremium : false,
                premiumType: existingSettings.premiumType || null,
                expiryDate: existingSettings.expiryDate || null,
                usedCodes: existingSettings.usedCodes || [],
                premiumActivatedAt: existingSettings.premiumActivatedAt || null
            };
            
            // If user is premium but has a prescription limit, remove the limit
            if (updatedSettings.isPremium && updatedSettings.prescriptionLimit !== null) {
                console.log('Premium user detected - removing prescription limit');
                updatedSettings.prescriptionLimit = null;
            }
            
            await StorageManager.set(updatedSettings);
        }
        
        // Now load everything else
        await resetForm();
        await renderHistory();
        await loadSettings();
        
        // Check premium status BEFORE setting up UI
        await checkPremiumStatus();
        await updateCounterDisplay();
        
        setEditMode(null);
        await initMedicineDatabase();
        await initMedicinePresets();
        
        document.getElementById('pDate').value = new Date().toISOString().split('T')[0];
        
        // Load used codes from storage
        const result = await StorageManager.get(['usedCodes']);
        window.usedCodes = new Set(result.usedCodes || []);
        
        setupEventListeners();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showCustomAlert('Initialization Error', 'Failed to initialize the application. Please refresh the page.', 'error');
    }
});

// ====== EVENT LISTENER SETUP ======
function setupEventListeners() {
    // Main form
    document.getElementById('addMed').addEventListener('click', () => addMedicineRow());
    document.getElementById('addPrescriptionBtn').addEventListener('click', showMedicineTable);
    document.getElementById('generateBtn').addEventListener('click', generatePrescription);
    document.getElementById('savePrescriptionBtn').addEventListener('click', savePrescription);
    document.getElementById('bulkPrintBtn').addEventListener('click', bulkPrintHistory);
    
    // New PDF Download button
    document.getElementById('downloadPDFBtn').addEventListener('click', downloadPrescriptionAsPDF);
    
    const mobileInput = document.getElementById('pMobile');
    document.getElementById('clearBtn').addEventListener('click', () => {
        if(confirm("Clear all entry fields?")){
            resetForm();
            mobileInput.style.setProperty('border', '1px solid #cccccc', 'important');
            mobileInput.style.backgroundColor = '#ffffff';
        } 
    });
    
    // Subscription button (always available)
    document.getElementById('subscriptionBtn').addEventListener('click', openPaymentModal);
    
    // New Prescription button
    document.getElementById('addNewPrescriptionBtn').addEventListener('click', addNewPrescription);
    
    // Mobile validation triggers
    ['pName', 'pAge', 'pSex'].forEach(id => {
        document.getElementById(id).addEventListener('input', function() {
            checkMobileDuplicate();
        });
    });

    // Mobile validation
    document.getElementById('pMobile').addEventListener('input', function() {
        this.style.border = '';
        this.style.backgroundColor = '';
        checkMobileDuplicate();
    });
    
    // Previous prescription dropdown
    document.getElementById('previousPrescriptionsDropdown').addEventListener('change', handlePreviousPrescriptionSelect);
    
    // Settings modal
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('closeModal').addEventListener('click', closeSettings);
    document.getElementById('cancelSettings').addEventListener('click', closeSettings);
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
    
    // Logo & signature
    document.getElementById('headerLogoInput').addEventListener('change', handleLogoUpload);
    document.getElementById('watermarkLogoInput').addEventListener('change', handleWatermarkUpload);
    document.getElementById('watermarkOpacity').addEventListener('input', updateOpacityPreview);
    document.getElementById('signatureInput').addEventListener('change', handleSignatureUpload);
    document.getElementById('removeSignatureBtn').addEventListener('click', removeSignature);
    document.getElementById('hospitalFontSize').addEventListener('input', updateFontSizePreview);
    
    // Payment modal
    document.getElementById('closePaymentModal').addEventListener('click', closePaymentModal);
    document.getElementById('showUnlockSection').addEventListener('click', showUnlockSection);
    document.getElementById('verifyUnlockCode').addEventListener('click', verifyUnlockCode);
    
    // Settings preview
    ['doctorName', 'doctorQualification', 'doctorRegNumber', 'doctorExperience', 
     'hospitalName', 'appointmentContact'].forEach(id => {
        document.getElementById(id).addEventListener('input', updatePreview);
    });
    
    // History search
    document.getElementById('histSearch').addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase().trim();
        document.querySelectorAll('.history-item').forEach(item => {
            const patientInfoDiv = item.querySelector('.patient-info');
            if (!patientInfoDiv) return;
            const itemText = patientInfoDiv.textContent.toLowerCase();
            item.style.setProperty('display', searchTerm === '' || itemText.includes(searchTerm) ? 'flex' : 'none', 'important');
        });
    });
    
    // Alert modals
    document.getElementById('closeAlertModal').addEventListener('click', closeCustomAlert);
    document.getElementById('alertCancelBtn').addEventListener('click', closeCustomAlert);
    document.getElementById('alertConfirmBtn').addEventListener('click', confirmCustomAlert);
    document.getElementById('closeSuccessModal').addEventListener('click', closeSuccessModal);
    document.getElementById('closeSuccessBtn').addEventListener('click', closeSuccessModal);
    
    // Import/export
    document.getElementById('importExportBtn').addEventListener('click', openImportExportModal);
    document.getElementById('closeImportExportModal').addEventListener('click', closeImportExportModal);
    document.getElementById('cancelImportExport').addEventListener('click', closeImportExportModal);
    document.getElementById('exportTab').addEventListener('click', () => switchImportExportTab('export'));
    document.getElementById('importTab').addEventListener('click', () => switchImportExportTab('import'));
    document.getElementById('exportNowBtn').addEventListener('click', exportHistory);
    document.getElementById('importNowBtn').addEventListener('click', importHistory);
    document.getElementById('fileDropArea').addEventListener('click', () => {
        document.getElementById('importFileInput').click();
    });
    document.getElementById('importFileInput').addEventListener('change', handleImportFileSelect);
    document.getElementById('removeFileBtn').addEventListener('click', removeImportFile);
    
    // Drag and drop
    const fileDropArea = document.getElementById('fileDropArea');
    fileDropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileDropArea.classList.add('drag-over');
    });
    fileDropArea.addEventListener('dragleave', () => {
        fileDropArea.classList.remove('drag-over');
    });
    fileDropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        fileDropArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length) handleImportFile(e.dataTransfer.files[0]);
    });
    
    // Import mode selection
    document.querySelectorAll('.import-mode-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const radioInput = option.querySelector('input[type="radio"]');
            if (radioInput && !radioInput.checked) {
                radioInput.checked = true;
                updateImportModeSelection();
            }
        });
    });
    
    // Premium copy
    const paymentNumber = document.getElementById('payment-number');
    if (paymentNumber) {
        paymentNumber.addEventListener('click', function() {
            const textToCopy = this.textContent.trim();
            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalHTML = this.innerHTML;
                this.style.transition = "all 0.3s ease";
                this.style.backgroundColor = "#28a745";
                this.style.color = "#ffffff";
                this.style.borderColor = "#1e7e34";
                this.innerHTML = "<span>✓ Copied to Clipboard</span>";
                setTimeout(() => {
                    this.style.backgroundColor = "";
                    this.style.color = "";
                    this.style.borderColor = "";
                    this.innerHTML = originalHTML;
                }, 1500);
            }).catch(err => console.error('Copy failed:', err));
        });
    }
    
    // Modal outside click closes
    ['customAlertModal', 'successModal', 'importExportModal', 'settingsModal', 'paymentModal'].forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.id === modalId) {
                    if (modalId === 'customAlertModal') closeCustomAlert();
                    else if (modalId === 'successModal') closeSuccessModal();
                    else if (modalId === 'importExportModal') closeImportExportModal();
                    else if (modalId === 'settingsModal') closeSettings();
                    else if (modalId === 'paymentModal') closePaymentModal();
                }
            });
        }
    });
    
    // Medicine Database Listeners
    document.getElementById('medicineDatabaseInput').addEventListener('change', handleMedicineDatabaseUpload);
    document.getElementById('downloadSampleCSV').addEventListener('click', downloadSampleCSV);
    document.getElementById('exportDatabase').addEventListener('click', exportMedicineDatabase);
    document.getElementById('clearDatabase').addEventListener('click', clearMedicineDatabase);
    
    // Preset Management Listeners
    document.getElementById('savePresetBtn').addEventListener('click', saveMedicinePreset);
    document.getElementById('presetSaveBtn').addEventListener('click', confirmSavePreset);
    document.getElementById('presetCancelBtn').addEventListener('click', closePresetModal);
    document.getElementById('closePresetModal').addEventListener('click', closePresetModal);
    document.getElementById('closePresetManagementModal').addEventListener('click', closePresetManagementModal);
    document.getElementById('closePresetManagementBtn').addEventListener('click', closePresetManagementModal);
    document.getElementById('managePresetsBtn').addEventListener('click', openPresetManagementModal);
    
    // Load Preset Dropdown
    const loadPresetDropdown = document.getElementById('loadPresetDropdown');
    if (loadPresetDropdown) {
        loadPresetDropdown.addEventListener('change', (e) => {
            const indexValue = e.target.value;
            if (indexValue !== "") {
                loadPreset(parseInt(indexValue), true);
            }
        });
    }
    
    // Modal outside clicks for preset modals
    ['presetModal', 'presetManagementModal'].forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.id === modalId) {
                    if (modalId === 'presetModal') closePresetModal();
                    else if (modalId === 'presetManagementModal') closePresetManagementModal();
                }
            });
        }
    });
    
    initImportExportModal(); 
}

// ====== PDF DOWNLOAD FUNCTION ======
async function downloadPrescriptionAsPDF() {
    // First check if the user has exceeded the prescription limit
    const canGenerate = await checkPrescriptionLimit();
    if (!canGenerate) {
        openPaymentModal();
        return;
    }
    
    // Validate required fields
    if (!validateRequiredFields()) {
        return;
    }
    
    // Check if at least one medicine is added with medicine name
    let hasValidMedicine = false;
    document.querySelectorAll('.med-row').forEach(row => {
        const medName = row.querySelector('.mName').value.trim();
        if (medName) {
            hasValidMedicine = true;
        }
    });
    
    if (!hasValidMedicine) {
        showCustomAlert('No Medicines', 'Please add at least one medicine to generate the prescription.', 'simple');
        return;
    }
    
    try {
        const result = await StorageManager.get(['prescriptionSettings']);
        const settings = result.prescriptionSettings || {};
        const defaultLogoUrl = "assets/logo.png";
        const defaultSignatureUrl = "assets/sign.png";
        
        const meds = [];
        document.querySelectorAll('.med-row').forEach(row => {
            const name = row.querySelector('.mName').value;
            if (name) {
                const daysValue = row.querySelector('.mDays').value;
                
                meds.push({
                    name: name,
                    qty: row.querySelector('.mQty').value,  
                    unit: row.querySelector('.mUnit').value, 
                    dose: row.querySelector('.mDose').value,
                    freq: row.querySelector('.mFreq').value,
                    days: daysValue,
                    meal: row.querySelector('.mMeal').value,
                    inst: row.querySelector('.mInst').value 
                });
            }
        });
        
        const rawDate = document.getElementById('pDate').value;
        const formattedDate = formatDisplayDate(rawDate);
        const pName = document.getElementById('pName').value;
        const fullData = {
            pName,
            pSex: document.getElementById('pSex').value,
            pAge: document.getElementById('pAge').value,
            pMobile: document.getElementById('pMobile').value,
            pDate: rawDate,
            cc: document.getElementById('ccInput').value,
            oe: document.getElementById('oeInput').value,
            pulse: document.getElementById('pulseInput').value,
            bp: document.getElementById('bpInput').value,
            temp: document.getElementById('tempInput').value,
            inv: document.getElementById('invInput').value,
            meds,
            defaultSignatureUrl
        };
        
        const sanitizedName = pName.replace(/[\\/:*?"<>|]/g, '');
        const docTitle = `Prescription_${sanitizedName}_${formattedDate.replace(/-/g, '')}`;
        
        // Generate and download PDF
        await generateAndDownloadPDF([{...fullData, settings}], docTitle);
        
        // Save to history and increment count
        await saveToHistory(fullData);
        await incrementPrescriptionCount();
        
    } catch (error) {
        console.error('PDF download error:', error);
        showCustomAlert('Error', 'Failed to download PDF.', 'error');
    }
}

// ====== UTILITY FUNCTIONS ======
function formatDisplayDate(dateStr) {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
}

// ====== HISTORY FUNCTIONS ======
async function saveToHistory(fullData) {
    try {
        const result = await StorageManager.get(['history']);
        const history = result.history || [];
        history.unshift(fullData);
        await StorageManager.set({ history: history });
        renderHistory();
    } catch (error) {
        console.error('Error saving to history:', error);
        throw error;
    }
}

async function renderHistory() {
    try {
        const result = await StorageManager.get(['history']);
        const history = result.history || [];
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = '';
        
        if (history.length === 0) {
            historyList.innerHTML = '<div style="text-align:center; color:#666; padding:20px;">No patient history found</div>';
            return;
        }
        
        history.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'history-item';
            
            const formattedDate = formatDisplayDate(item.pDate);
            const medsCount = item.meds ? item.meds.length : 0;
            
            li.innerHTML = `
                <div class="patient-info">
                    <strong>${item.pName}</strong> (${item.pAge}, ${item.pSex})<br>
                    <small>${item.pMobile} • ${formattedDate} • ${medsCount} med(s)</small>
                </div>
                <div class="history-buttons">
                    <button class="btn-edit-patient" data-index="${index}">Edit Patient</button>
                    <button class="btn-edit-prescription" data-index="${index}">Edit Prescription</button>
                    <button class="btn-remove undo-delete-btn" data-index="${index}">Print</button>
                </div>
            `;
            
            // Edit Patient button
            li.querySelector('.btn-edit-patient').addEventListener('click', async () => {
                await loadPatientForEdit(index, 'patient');
            });
            
            // Edit Prescription button
            li.querySelector('.btn-edit-prescription').addEventListener('click', async () => {
                await loadPatientForEdit(index, 'prescription');
            });
            
            // Print button
            li.querySelector('.btn-remove').addEventListener('click', async () => {
                try {
                    await openHistoryPrintView(item);
                    await incrementPrescriptionCount();
                } catch (error) {
                    console.error('Error printing history item:', error);
                    showCustomAlert('Error', 'Failed to print prescription.', 'error');
                }
            });
            
            historyList.appendChild(li);
        });
    } catch (error) {
        console.error('Error rendering history:', error);
        showCustomAlert('Error', 'Failed to load patient history.', 'error');
    }
}

async function loadPatientForEdit(index, mode) {
    try {
        const result = await StorageManager.get(['history']);
        const history = result.history || [];
        
        if (index >= history.length) {
            showCustomAlert('Error', 'Cannot find the prescription to edit.', 'error');
            return;
        }
        
        const item = history[index];
        
        // Fill form with patient data
        document.getElementById('pName').value = item.pName || '';
        document.getElementById('pSex').value = item.pSex || 'Male';
        document.getElementById('pAge').value = item.pAge || '';
        document.getElementById('pMobile').value = item.pMobile || '';
        document.getElementById('pDate').value = item.pDate || new Date().toISOString().split('T')[0];
        document.getElementById('ccInput').value = item.cc || '';
        document.getElementById('oeInput').value = item.oe || '';
        document.getElementById('pulseInput').value = item.pulse || '';
        document.getElementById('bpInput').value = item.bp || '';
        document.getElementById('tempInput').value = item.temp || '';
        document.getElementById('invInput').value = item.inv || '';
        
        // Clear and populate medicine table
        const medBody = document.getElementById('medBody');
        medBody.innerHTML = '';
        
        if (item.meds && Array.isArray(item.meds)) {
            item.meds.forEach(med => {
                addMedicineRow(med);
            });
        } else {
            addMedicineRow(); // Add one empty row if no medicines
        }
        
        // Set edit mode
        editingIndex = index;
        setEditMode(mode, index);
        
        // Show edit mode indicator
        const indicator = document.getElementById('editModeIndicator');
        indicator.textContent = mode === 'patient' ? 
            '✏️ EDITING PATIENT DETAILS - Updating will change ALL prescriptions for this patient' :
            '✏️ EDITING PRESCRIPTION - Saving will create a new prescription or update existing one';
        indicator.className = `edit-mode-indicator edit-mode-${mode}`;
        indicator.style.display = 'block';
        
        // Scroll to top
        window.scrollTo(0, 0);
        
    } catch (error) {
        console.error('Error loading patient for edit:', error);
        showCustomAlert('Error', 'Failed to load patient data for editing.', 'error');
    }
}

// ====== MEDICINE TABLE FUNCTIONS ======
function showMedicineTable() {
    document.getElementById('addPrescriptionContainer').style.display = 'none';
    document.getElementById('medicineTableContainer').style.display = 'block';
    document.getElementById('addMed').style.display = 'block';
    document.getElementById('addNewPrescriptionBtn').style.display = 'block';
    
    // Ensure at least one medicine row exists
    const medBody = document.getElementById('medBody');
    if (medBody.children.length === 0) {
        addMedicineRow();
    }
}

// ====== PREVIOUS PRESCRIPTION FUNCTIONS ======
async function handlePreviousPrescriptionSelect(event) {
    const value = event.target.value;
    
    if (value === 'default') {
        return;
    }
    
    selectedPrescriptionIndex = parseInt(value);
    const selectedPrescription = currentPatientHistory[selectedPrescriptionIndex];
    
    if (selectedPrescription) {
        // Fill the form with the selected prescription data
        document.getElementById('ccInput').value = selectedPrescription.cc || '';
        document.getElementById('oeInput').value = selectedPrescription.oe || '';
        document.getElementById('pulseInput').value = selectedPrescription.pulse || '';
        document.getElementById('bpInput').value = selectedPrescription.bp || '';
        document.getElementById('tempInput').value = selectedPrescription.temp || '';
        document.getElementById('invInput').value = selectedPrescription.inv || '';
        
        // Clear and populate medicine table
        const medBody = document.getElementById('medBody');
        medBody.innerHTML = '';
        
        if (selectedPrescription.meds && Array.isArray(selectedPrescription.meds)) {
            selectedPrescription.meds.forEach(med => {
                addMedicineRow(med);
            });
        } else {
            addMedicineRow();
        }
        
        updateNewPrescriptionButtonState();
    }
}

async function loadPatientPrescriptions(mobile) {
    try {
        const result = await StorageManager.get(['history']);
        const history = result.history || [];
        
        // Filter prescriptions for this mobile number, excluding empty medicine lists
        currentPatientHistory = history.filter(item => 
            item.pMobile === mobile && 
            item.meds && 
            Array.isArray(item.meds) && 
            item.meds.length > 0
        );
        
        return currentPatientHistory;
    } catch (error) {
        console.error('Error loading patient prescriptions:', error);
        return [];
    }
}

function populatePreviousPrescriptionsDropdown(prescriptions) {
    const dropdown = document.getElementById('previousPrescriptionsDropdown');
    const container = document.getElementById('previousPrescriptionsContainer');
    
    // Clear existing options except the first one
    while (dropdown.options.length > 1) {
        dropdown.remove(1);
    }
    
    if (prescriptions.length > 0) {
        container.style.display = 'block';
        
        prescriptions.forEach((prescription, index) => {
            const date = formatDisplayDate(prescription.pDate);
            const medCount = prescription.meds ? prescription.meds.length : 0;
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${date} (${medCount} meds)`;
            dropdown.appendChild(option);
        });
        
        dropdown.disabled = false;
    } else {
        container.style.display = 'none';
        dropdown.disabled = true;
    }
}

function updateNewPrescriptionButtonState() {
    const addNewPrescriptionBtn = document.getElementById('addNewPrescriptionBtn');
    if (!addNewPrescriptionBtn) return;
    
    if (currentPatientHistory.length > 0 && editingMode === 'prescription') {
        addNewPrescriptionBtn.disabled = false;
        addNewPrescriptionBtn.style.backgroundColor = '#28a745';
        addNewPrescriptionBtn.style.cursor = 'pointer';
    } else {
        addNewPrescriptionBtn.disabled = true;
        addNewPrescriptionBtn.style.backgroundColor = '#6c757d';
        addNewPrescriptionBtn.style.cursor = 'not-allowed';
    }
}

// ====== IMPORT/EXPORT MODAL FUNCTIONS ======
function initImportExportModal() {
    switchImportExportTab('export');
}

function switchImportExportTab(tab) {
    const exportTab = document.getElementById('exportTab');
    const importTab = document.getElementById('importTab');
    const exportSection = document.getElementById('exportSection');
    const importSection = document.getElementById('importSection');
    
    if (tab === 'export') {
        exportTab.style.borderBottom = '3px solid #0056b3';
        exportTab.style.background = 'transparent';
        exportTab.style.color = '#0056b3';
        importTab.style.borderBottom = 'none';
        importTab.style.background = 'transparent';
        importTab.style.color = '#666';
        exportSection.style.display = 'block';
        importSection.style.display = 'none';
        updateExportStats();
    } else {
        importTab.style.borderBottom = '3px solid #0056b3';
        importTab.style.background = 'transparent';
        importTab.style.color = '#0056b3';
        exportTab.style.borderBottom = 'none';
        exportTab.style.background = 'transparent';
        exportTab.style.color = '#666';
        exportSection.style.display = 'none';
        importSection.style.display = 'block';
    }
}

function updateImportModeSelection() {
    document.querySelectorAll('.import-mode-option').forEach(option => {
        const radio = option.querySelector('input[type="radio"]');
        if (radio.checked) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
}
