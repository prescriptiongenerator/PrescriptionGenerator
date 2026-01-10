// history-manager.js - Patient history management (Web Compatible)

// ====== HISTORY MANAGEMENT ======
async function renderHistory() {
    try {
        const result = await StorageManager.get(['history']);
        const list = document.getElementById('historyList');
        const history = result.history || [];
        list.innerHTML = '';
        
        if (history.length === 0) {
            list.innerHTML = '<li style="text-align: center; color: #666; padding: 20px;">No history found</li>';
            return;
        }
        
        // Group patients by mobile number
        const patientGroups = {};
        history.forEach((item, index) => {
            const mobile = item.pMobile;
            if (!patientGroups[mobile]) {
                patientGroups[mobile] = [];
            }
            patientGroups[mobile].push({...item, originalIndex: index});
        });
        
        // For each patient, decide what to display
        Object.keys(patientGroups).forEach(mobile => {
            const patientEntries = patientGroups[mobile];
            
            // Check if this patient has any prescriptions
            const hasPrescriptions = patientEntries.some(entry => 
                entry.meds && Array.isArray(entry.meds) && entry.meds.length > 0
            );
            
            if (hasPrescriptions) {
                // Show only prescription entries (with medicines)
                patientEntries.forEach(entry => {
                    if (entry.meds && Array.isArray(entry.meds) && entry.meds.length > 0) {
                        createHistoryListItem(entry, entry.originalIndex);
                    }
                });
            } else {
                // Show the first entry (without prescriptions)
                if (patientEntries.length > 0) {
                    createHistoryListItem(patientEntries[0], patientEntries[0].originalIndex);
                }
            }
        });
        
        function createHistoryListItem(item, originalIndex) {
            const li = document.createElement('li');
            li.className = 'history-item';
            const displayText = `${item.pName} (${item.pAge}y) | ${formatDisplayDate(item.pDate)} | ${item.pMobile}`;
            
            li.innerHTML = `
                <div class="patient-info" style="flex-grow: 1; cursor: pointer; font-size: 13px; 
                     white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${displayText}
                </div>
                <div class="history-buttons">
                    <button class="btn-edit-patient">Patient Details</button>
                    <button class="btn-edit-prescription">Prescriptions</button>
                    <button class="btn-remove">Delete</button>
                </div>
            `;
            
            const patientInfo = li.querySelector('.patient-info');
            patientInfo.onclick = () => openHistoryPrintView(item);
            
            li.querySelector('.btn-edit-patient').onclick = (e) => {
                e.stopPropagation();
                loadHistoryItem(item);
                setEditMode('patient', originalIndex);
            };
            
            li.querySelector('.btn-edit-prescription').onclick = async (e) => {
                e.stopPropagation();
                await loadHistoryItem(item);
                await setEditMode('prescription', originalIndex);
                
                // Load patient prescriptions for the dropdown
                const mobile = item.pMobile;
                if (mobile) {
                    const patientHistory = await loadPatientPrescriptions(mobile);
                    populatePreviousPrescriptionsDropdown(patientHistory);
                }
            };
            
            li.querySelector('.btn-remove').onclick = (e) => {
                e.stopPropagation();
                deleteHistoryItem(originalIndex);
            };
            
            list.appendChild(li);
        }
    } catch (error) {
        console.error('Error rendering history:', error);
        showCustomAlert('Error', 'Failed to load patient history.', 'error');
    }
}

function loadHistoryItem(item) {
    resetForm();
    document.getElementById('pName').value = item.pName || '';
    document.getElementById('pSex').value = item.pSex || 'Male';
    document.getElementById('pAge').value = item.pAge || '';
    document.getElementById('pMobile').value = item.pMobile || '';
    document.getElementById('pDate').value = item.pDate || '';
    document.getElementById('ccInput').value = item.cc || '';
    document.getElementById('oeInput').value = item.oe || '';
    document.getElementById('pulseInput').value = item.pulse || '';
    document.getElementById('bpInput').value = item.bp || '';
    document.getElementById('tempInput').value = item.temp || item.rbs || '';
    document.getElementById('invInput').value = item.inv || '';
    document.getElementById('medBody').innerHTML = '';
    
    if (item.meds && Array.isArray(item.meds)) {
        item.meds.forEach(m => addMedicineRow(m));
    }
    document.querySelector('.main-form').scrollTop = 0;
    setTimeout(() => checkMobileDuplicate(), 100);
}

async function deleteHistoryItem(index) {
    try {
        const result = await StorageManager.get(['history']);
        const history = result.history || [];
        const item = history[index];
        const patientName = item ? item.pName : 'Unknown Patient';
        
        showCustomAlert('Delete Prescription', '', 'delete', patientName).then(async (confirmed) => {
            if (confirmed) {
                history.splice(index, 1);
                await StorageManager.set({ history: history });
                renderHistory();
                showSuccessMessage('Prescription Deleted', `Prescription for "${patientName}" has been permanently deleted.`);
            }
        }).catch(() => console.log('Delete cancelled by user'));
    } catch (error) {
        console.error('Error deleting prescription:', error);
        showCustomAlert('Error', 'Failed to delete prescription.', 'error');
    }
}

async function saveToHistory(fullData) {
    try {
        const result = await StorageManager.get(['history']);
        let history = result.history || [];
        const hasMeds = fullData.meds && Array.isArray(fullData.meds) && fullData.meds.length > 0;
        
        // Check if patient already exists
        const existingEntries = history.filter(item => 
            item.pMobile === fullData.pMobile && 
            item.pName === fullData.pName &&
            item.pAge === fullData.pAge &&
            item.pSex === fullData.pSex
        );
        
        // Check if patient has any prescriptions
        const hasExistingPrescriptions = existingEntries.some(entry => 
            entry.meds && Array.isArray(entry.meds) && entry.meds.length > 0
        );
        
        if (hasMeds) {
            // Patient is saving a prescription
            // Remove any empty entries for this patient
            history = history.filter(item => 
                !(item.pMobile === fullData.pMobile && 
                  item.pName === fullData.pName &&
                  (!item.meds || !Array.isArray(item.meds) || item.meds.length === 0))
            );
            
            // Add the new prescription
            history.unshift(fullData);
        } else {
            // Patient is saving without prescription
            if (hasExistingPrescriptions) {
                // Patient already has prescriptions, don't add empty entry
                return;
            }
            
            // Remove any existing empty entry for this patient
            history = history.filter(item => 
                !(item.pMobile === fullData.pMobile && 
                  item.pName === fullData.pName &&
                  (!item.meds || !Array.isArray(item.meds) || item.meds.length === 0))
            );
            
            // Add the empty entry
            history.unshift(fullData);
        }
        
        if (history.length > 100) history = history.slice(0, 100);
        await StorageManager.set({ history: history });
        renderHistory();
    } catch (error) {
        console.error('Error saving to history:', error);
        showCustomAlert('Error', 'Failed to save patient history.', 'error');
    }
}

// ====== PREVIOUS PRESCRIPTION FUNCTIONS ======
async function loadPatientPrescriptions(mobileNumber) {
    try {
        const result = await StorageManager.get(['history']);
        const history = result.history || [];
        // Find all prescriptions for this mobile number (with at least one medicine)
        const patientHistory = history.filter(item => 
            item.pMobile && item.pMobile.trim() === mobileNumber.trim() &&
            item.meds && item.meds.length > 0
        );
        
        // Sort by date (newest first)
        patientHistory.sort((a, b) => new Date(b.pDate) - new Date(a.pDate));
        
        currentPatientHistory = patientHistory;
        return patientHistory;
    } catch (error) {
        console.error('Error loading patient prescriptions:', error);
        return [];
    }
}

function populatePreviousPrescriptionsDropdown(patientHistory) {
    const dropdown = document.getElementById('previousPrescriptionsDropdown');
    const container = document.getElementById('previousPrescriptionsContainer');
    const addPrescriptionContainer = document.getElementById('addPrescriptionContainer');
    const medicineTableContainer = document.getElementById('medicineTableContainer');
    const addMedBtn = document.getElementById('addMed');
    const addNewPrescriptionBtn = document.getElementById('addNewPrescriptionBtn');
    
    // Clear existing options except the first one
    while (dropdown.options.length > 1) {
        dropdown.remove(1);
    }
    
    if (patientHistory.length > 0) {
        // Add each prescription to dropdown
        patientHistory.forEach((prescription, index) => {
            const date = formatDisplayDate(prescription.pDate);
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${date}`;
            dropdown.appendChild(option);
        });
        
        // Show dropdown and hide add prescription button
        container.style.display = 'block';
        addPrescriptionContainer.style.display = 'none';
        medicineTableContainer.style.display = 'block';
        
        // Set dropdown to default "Previous Prescription" option
        dropdown.selectedIndex = 0;
        handlePreviousPrescriptionSelect();
        
        // Enable New Prescription button since we have previous prescriptions
        addNewPrescriptionBtn.disabled = false;
        addNewPrescriptionBtn.style.backgroundColor = '#28a745';
        addNewPrescriptionBtn.style.cursor = 'pointer';
    } else {
        // No previous prescriptions - show Add Prescription button
        container.style.display = 'none';
        addPrescriptionContainer.style.display = 'flex';
        medicineTableContainer.style.display = 'none';
        
        // Disable New Prescription button since there are no previous prescriptions
        addNewPrescriptionBtn.disabled = true;
        addNewPrescriptionBtn.style.backgroundColor = '#6c757d';
        addNewPrescriptionBtn.style.cursor = 'not-allowed';
    }
    
    // Always show medicine button
    addMedBtn.style.display = 'block';
}

function handlePreviousPrescriptionSelect() {
    const dropdown = document.getElementById('previousPrescriptionsDropdown');
    const medicineTableContainer = document.getElementById('medicineTableContainer');
    const addMedBtn = document.getElementById('addMed');
    const addNewPrescriptionBtn = document.getElementById('addNewPrescriptionBtn');
    const selectedValue = dropdown.value;
    
    if (selectedValue === 'default') {
        // Default option selected - show medicine table but don't load any prescription
        medicineTableContainer.style.display = 'block';
        addMedBtn.style.display = 'block';
        
        // Enable New Prescription button since we have previous prescriptions
        addNewPrescriptionBtn.disabled = false;
        addNewPrescriptionBtn.style.backgroundColor = '#28a745';
        addNewPrescriptionBtn.style.cursor = 'pointer';
        
        // Clear medicine table and add one empty row
        document.getElementById('medBody').innerHTML = '';
        addMedicineRow();
        
        // Clear prescription data from form (but keep patient info)
        clearPrescriptionFields();
    } else if (selectedValue !== '' && currentPatientHistory.length > 0) {
        const selectedIndex = parseInt(selectedValue);
        if (!isNaN(selectedIndex) && selectedIndex >= 0 && currentPatientHistory[selectedIndex]) {
            selectedPrescriptionIndex = selectedIndex;
            const selectedPrescription = currentPatientHistory[selectedIndex];
            
            // Show medicine table
            medicineTableContainer.style.display = 'block';
            
            // Enable both buttons
            addMedBtn.style.display = 'block';
            addNewPrescriptionBtn.disabled = false;
            addNewPrescriptionBtn.style.backgroundColor = '#28a745';
            addNewPrescriptionBtn.style.cursor = 'pointer';
            
            // Load the selected prescription into the form
            loadPrescriptionIntoForm(selectedPrescription);
        }
    } else {
        // No prescription selected or no previous prescriptions
        if (currentPatientHistory.length > 0) {
            medicineTableContainer.style.display = 'block';
            addMedBtn.style.display = 'block';
            
            // Disable New Prescription button if we have previous prescriptions
            addNewPrescriptionBtn.disabled = false;
            addNewPrescriptionBtn.style.backgroundColor = '#28a745';
            addNewPrescriptionBtn.style.cursor = 'pointer';
            
            // Clear medicine table and add one empty row
            document.getElementById('medBody').innerHTML = '';
            addMedicineRow();
            
            // Clear prescription fields
            clearPrescriptionFields();
        } else {
            // No previous prescriptions at all
            medicineTableContainer.style.display = 'none';
            addMedBtn.style.display = 'none';
            
            // Disable New Prescription button
            addNewPrescriptionBtn.disabled = true;
            addNewPrescriptionBtn.style.backgroundColor = '#6c757d';
            addNewPrescriptionBtn.style.cursor = 'not-allowed';
        }
    }
}

function clearPrescriptionFields() {
    // Clear prescription fields but keep patient info
    document.getElementById('ccInput').value = '';
    document.getElementById('oeInput').value = '';
    document.getElementById('pulseInput').value = '';
    document.getElementById('bpInput').value = '';
    document.getElementById('tempInput').value = '';
    document.getElementById('invInput').value = '';
    document.getElementById('medBody').innerHTML = '';
    addMedicineRow();
}

function loadPrescriptionIntoForm(prescription) {
    // Load clinical findings
    document.getElementById('ccInput').value = prescription.cc || '';
    document.getElementById('oeInput').value = prescription.oe || '';
    document.getElementById('pulseInput').value = prescription.pulse || '';
    document.getElementById('bpInput').value = prescription.bp || '';
    document.getElementById('tempInput').value = prescription.temp || prescription.rbs || '';
    document.getElementById('invInput').value = prescription.inv || '';
    
    // Clear existing medicine rows
    document.getElementById('medBody').innerHTML = '';
    
    // Load medicines
    if (prescription.meds && Array.isArray(prescription.meds)) {
        prescription.meds.forEach(m => addMedicineRow(m));
    }
    
    // If no medicines, add one empty row
    if (!prescription.meds || prescription.meds.length === 0) {
        addMedicineRow();
    }
}

function showMedicineTable() {
    // Hide add prescription button
    document.getElementById('addPrescriptionContainer').style.display = 'none';
    
    // Show medicine table
    document.getElementById('medicineTableContainer').style.display = 'block';
    
    // Clear any existing medicines and add one empty row
    document.getElementById('medBody').innerHTML = '';
    addMedicineRow();
    
    // Update button states
    updateNewPrescriptionButtonState();
    
    // Show both buttons
    document.getElementById('addMed').style.display = 'block';
    document.getElementById('addNewPrescriptionBtn').style.display = 'block';
}

function updateNewPrescriptionButtonState() {
    const addNewPrescriptionBtn = document.getElementById('addNewPrescriptionBtn');
    const dropdown = document.getElementById('previousPrescriptionsDropdown');
    const selectedIndex = parseInt(dropdown.value);
    
    // Only enable if a valid index is selected AND there is history
    if (!isNaN(selectedIndex) && selectedIndex >= 0 && currentPatientHistory.length > 0) {
        addNewPrescriptionBtn.disabled = false;
        addNewPrescriptionBtn.style.backgroundColor = '#28a745';
        addNewPrescriptionBtn.style.cursor = 'pointer';
    } else {
        addNewPrescriptionBtn.disabled = true;
        addNewPrescriptionBtn.style.backgroundColor = '#6c757d';
        addNewPrescriptionBtn.style.cursor = 'not-allowed';
    }
}

// ====== UTILITY FUNCTION ======
function formatDisplayDate(dateStr) {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
}