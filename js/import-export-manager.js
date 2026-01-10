// import-export-manager.js - Import/export functionality (Web Compatible)

// ====== IMPORT/EXPORT FUNCTIONS ======
function initImportExportModal() {
    selectedExportOption = 'local';
    updateImportModeSelection();
}

function openImportExportModal() {
    document.getElementById('importExportModal').style.display = 'flex';
    updateExportStats();
    switchImportExportTab('export');
}

function closeImportExportModal() {
    document.getElementById('importExportModal').style.display = 'none';
    removeImportFile();
}

function switchImportExportTab(tab) {
    const exportTab = document.getElementById('exportTab');
    const importTab = document.getElementById('importTab');
    const exportSection = document.getElementById('exportSection');
    const importSection = document.getElementById('importSection');
    
    if (tab === 'export') {
        exportTab.style.borderBottom = '3px solid #0056b3';
        exportTab.style.color = '#0056b3';
        importTab.style.borderBottom = 'none';
        importTab.style.color = '#666';
        exportSection.style.display = 'block';
        importSection.style.display = 'none';
        updateExportStats();
    } else {
        importTab.style.borderBottom = '3px solid #0056b3';
        importTab.style.color = '#0056b3';
        exportTab.style.borderBottom = 'none';
        exportTab.style.color = '#666';
        exportSection.style.display = 'none';
        importSection.style.display = 'block';
        updateImportModeSelection();
    }
}

function updateImportModeSelection() {
    document.querySelectorAll('.import-mode-option').forEach(option => {
        const radioInput = option.querySelector('input[type="radio"]');
        if (radioInput && radioInput.checked) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
}

async function updateExportStats() {
    const statsContainer = document.getElementById('exportStats');
    try {
        const result = await StorageManager.get(['history']);
        const history = result.history || [];
        
        // Count unique patients by mobile number
        const uniquePatients = new Set();
        const prescriptionsByPatient = {};
        
        history.forEach(item => {
            if (item.pMobile && item.pMobile.trim() !== '') {
                uniquePatients.add(item.pMobile.trim());
                
                // Count prescriptions per patient
                if (!prescriptionsByPatient[item.pMobile]) {
                    prescriptionsByPatient[item.pMobile] = 0;
                }
                prescriptionsByPatient[item.pMobile]++;
            }
        });
        
        const totalPatients = uniquePatients.size;
        const totalPrescriptions = history.length;
        let oldestDate = new Date();
        let newestDate = new Date('2000-01-01');
        
        history.forEach(item => {
            if (item.pDate) {
                const itemDate = new Date(item.pDate);
                if (itemDate < oldestDate) oldestDate = itemDate;
                if (itemDate > newestDate) newestDate = itemDate;
            }
        });
        
        const dateRange = oldestDate.getFullYear() !== new Date().getFullYear() ? 
            `${oldestDate.toLocaleDateString()} - ${newestDate.toLocaleDateString()}` : 
            `${oldestDate.getDate()}/${oldestDate.getMonth()+1} - ${newestDate.getDate()}/${newestDate.getMonth()+1}`;
        const estimatedSize = (totalPrescriptions * 2).toFixed(1);
        
        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${totalPatients}</div>
                <div class="stat-label">Unique Patients</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalPrescriptions}</div>
                <div class="stat-label">Total Prescriptions</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${dateRange}</div>
                <div class="stat-label">Date Range</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${estimatedSize} KB</div>
                <div class="stat-label">Estimated Size</div>
            </div>
        `;
    } catch (error) {
        console.error('Error updating export stats:', error);
        statsContainer.innerHTML = '<div style="color: #dc3545; text-align: center;">Failed to load statistics</div>';
    }
}

async function exportHistory() {
    try {
        const result = await StorageManager.get(['history', 'prescriptionSettings']);
        const history = result.history || [];
        const settings = result.prescriptionSettings || {};
        
        if (history.length === 0) {
            showCustomAlert('No Data', 'There is no patient history to export.', 'info');
            return;
        }
        
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            appName: 'Prescription Generator Pro',
            data: { 
                history: history, 
                settings: settings, 
                metadata: { 
                    totalPatients: history.length, 
                    exportSource: 'Web Application' 
                } 
            }
        };
        
        const jsonString = JSON.stringify(exportData, null, 2);
        exportToLocalDrive(jsonString);
    } catch (error) {
        console.error('Export error:', error);
        showCustomAlert('Export Failed', 'Failed to export patient history. Please try again.', 'error');
    }
}

function exportToLocalDrive(jsonString) {
    try {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date();
        const dateStr = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        const filename = `prescription_backup_${dateStr}.json`;
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 100);
        showSuccessMessage('Export Successful', `Patient history exported to ${filename}`);
        setTimeout(() => closeImportExportModal(), 2000);
    } catch (error) {
        console.error('Local export error:', error);
        showCustomAlert('Export Failed', 'Failed to download file. Please try again.', 'error');
    }
}

function handleImportFileSelect(event) {
    if (event.target.files.length > 0) handleImportFile(event.target.files[0]);
}

function handleImportFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.json')) {
        showCustomAlert('Invalid File', 'Please select a valid JSON file exported from this application.', 'error');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        showCustomAlert('File Too Large', 'The selected file is too large. Maximum size is 10MB.', 'error');
        return;
    }
    
    importedFile = file;
    importFileData = null;
    const fileInfo = document.getElementById('uploadedFileInfo');
    const fileName = document.getElementById('uploadedFileName');
    const fileSize = document.getElementById('uploadedFileSize');
    const importBtn = document.getElementById('importNowBtn');
    
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.style.display = 'flex';
    importBtn.disabled = true;
    importBtn.innerHTML = '<span>📤 Reading file...</span>';
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            const parsedData = JSON.parse(content);
            if (!parsedData.data || !parsedData.data.history) {
                throw new Error('Invalid backup file format');
            }
            importFileData = parsedData;
            importBtn.disabled = false;
            importBtn.innerHTML = '<span>📤 Import Patient History</span>';
        } catch (error) {
            console.error('File parse error:', error);
            showCustomAlert('Invalid File', 'The selected file is not a valid backup file. Please select a file exported from this application.', 'error');
            removeImportFile();
        }
    };
    
    reader.onerror = function() {
        showCustomAlert('Read Error', 'Failed to read the file. Please try again.', 'error');
        removeImportFile();
    };
    reader.readAsText(file);
}

function removeImportFile() {
    importedFile = null;
    importFileData = null;
    const fileInput = document.getElementById('importFileInput');
    const fileInfo = document.getElementById('uploadedFileInfo');
    const importBtn = document.getElementById('importNowBtn');
    fileInput.value = '';
    fileInfo.style.display = 'none';
    importBtn.disabled = true;
    importBtn.innerHTML = '<span>📤 Import Patient History</span>';
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

async function importHistory() {
    if (!importFileData || !importFileData.data) {
        showCustomAlert('No File', 'Please select a backup file to import.', 'error');
        return;
    }
    
    try {
        const importMode = document.querySelector('input[name="importMode"]:checked').value;
        const importedHistory = importFileData.data.history || [];
        const importedSettings = importFileData.data.settings || {};
        
        if (importedHistory.length === 0) {
            showCustomAlert('Empty File', 'The backup file contains no patient history.', 'info');
            return;
        }
        
        const result = await StorageManager.get(['history', 'prescriptionSettings']);
        const currentHistory = result.history || [];
        const currentSettings = result.prescriptionSettings || {};
        let newHistory = [];
        
        switch(importMode) {
            case 'merge':
                const existingKeys = new Set();
                currentHistory.forEach(item => {
                    const key = `${item.pName || ''}-${item.pDate || ''}-${item.pMobile || ''}`;
                    existingKeys.add(key);
                });
                newHistory = [...currentHistory];
                importedHistory.forEach(item => {
                    const key = `${item.pName || ''}-${item.pDate || ''}-${item.pMobile || ''}`;
                    if (!existingKeys.has(key)) newHistory.push(item);
                });
                break;
            case 'replace':
                newHistory = importedHistory;
                break;
            case 'append':
                newHistory = [...currentHistory, ...importedHistory];
                break;
        }
        
        if (newHistory.length > 1000) newHistory = newHistory.slice(0, 1000);
        const newSettings = { ...currentSettings, ...importedSettings };
        
        await StorageManager.set({ 
            history: newHistory, 
            prescriptionSettings: newSettings 
        });
        
        renderHistory();
        showSuccessMessage('Import Successful', 
            `Successfully imported ${importedHistory.length} patient records.\nTotal records: ${newHistory.length}`);
        setTimeout(() => { 
            closeImportExportModal(); 
            resetForm(); 
        }, 2000);
    } catch (error) {
        console.error('Import error:', error);
        showCustomAlert('Import Failed', 'Failed to import patient history. The file may be corrupted.', 'error');
    }
}