// main.js - Core initialization and event setup (Web Compatible Version)

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
        await resetForm();
        await renderHistory();
        await loadSettings();
        await updateCounterDisplay();
        setEditMode(null);
        await checkPremiumStatus();
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
    
    const mobileInput = document.getElementById('pMobile');
    document.getElementById('clearBtn').addEventListener('click', () => {
        if(confirm("Clear all entry fields?")){
            resetForm();
            mobileInput.style.setProperty('border', '1px solid #cccccc', 'important');
            mobileInput.style.backgroundColor = '#ffffff';
        } 
    });
    
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