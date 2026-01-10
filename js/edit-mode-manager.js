// edit-mode-manager.js - Edit mode management functions (Web Compatible)

// ====== EDIT MODE MANAGEMENT ======
async function setEditMode(mode, index = null) {
    const indicator = document.getElementById('editModeIndicator');
    const saveBtn = document.getElementById('savePrescriptionBtn');
    
    editingMode = mode;
    editingIndex = index;
    
    if (mode === 'patient') {
        saveBtn.textContent = 'Update Patient Details';
        enablePatientFields(true);
        enablePrescriptionFields(false);
        
        // Hide prescription UI elements
        document.getElementById('previousPrescriptionsContainer').style.display = 'none';
        document.getElementById('addPrescriptionContainer').style.display = 'none';
        document.getElementById('medicineTableContainer').style.display = 'block';
        document.getElementById('addMed').style.display = 'block';
        document.getElementById('addNewPrescriptionBtn').style.display = 'block';
    } else if (mode === 'prescription') {
        saveBtn.textContent = 'Save Prescription';
        enablePatientFields(false);
        enablePrescriptionFields(true);
        
        // Load patient prescriptions and show appropriate UI
        const mobile = document.getElementById('pMobile').value;
        if (mobile) {
            const patientHistory = await loadPatientPrescriptions(mobile);
            populatePreviousPrescriptionsDropdown(patientHistory);
        } else {
            // If no mobile number, show add prescription button
            document.getElementById('previousPrescriptionsContainer').style.display = 'none';
            document.getElementById('addPrescriptionContainer').style.display = 'flex';
            document.getElementById('medicineTableContainer').style.display = 'none';
            document.getElementById('addMed').style.display = 'none';
            document.getElementById('addNewPrescriptionBtn').style.display = 'none';
        }
    } else {
        indicator.style.display = 'none';
        saveBtn.textContent = 'Save Prescription';
        enablePatientFields(true);
        enablePrescriptionFields(true);
        editingMode = null;
        editingIndex = null;
        selectedPrescriptionIndex = null;
        currentPatientHistory = [];
        
        // Reset prescription UI to default state
        resetPrescriptionUI();
    }
}

function resetPrescriptionUI() {
    document.getElementById('previousPrescriptionsContainer').style.display = 'none';
    document.getElementById('addPrescriptionContainer').style.display = 'none';
    document.getElementById('medicineTableContainer').style.display = 'block';
    document.getElementById('addMed').style.display = 'block';
    document.getElementById('addNewPrescriptionBtn').style.display = 'block';
    
    // Clear dropdown
    const dropdown = document.getElementById('previousPrescriptionsDropdown');
    while (dropdown.options.length > 1) {
        dropdown.remove(1);
    }
    
    // Update New Prescription button state
    updateNewPrescriptionButtonState();
}

function enablePatientFields(enable) {
    ['pName', 'pSex', 'pAge', 'pMobile', 'pDate'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.disabled = !enable;
    });
}

function enablePrescriptionFields(enable) {
    ['ccInput', 'oeInput', 'pulseInput', 'bpInput', 'tempInput', 'invInput'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.disabled = !enable;
    });
    
    document.querySelectorAll('.med-row').forEach(row => {
        row.querySelectorAll('input, select').forEach(input => input.disabled = !enable);
        const removeBtn = row.querySelector('.btn-remove');
        if (removeBtn) removeBtn.disabled = !enable;
    });
    
    const addMedBtn = document.getElementById('addMed');
    if (addMedBtn) addMedBtn.disabled = !enable;
    
    const addPrescriptionBtn = document.getElementById('addPrescriptionBtn');
    if (addPrescriptionBtn) addPrescriptionBtn.disabled = !enable;
    
    const previousDropdown = document.getElementById('previousPrescriptionsDropdown');
    if (previousDropdown) previousDropdown.disabled = !enable;
    
    const addNewPrescriptionBtn = document.getElementById('addNewPrescriptionBtn');
    if (addNewPrescriptionBtn) {
        addNewPrescriptionBtn.disabled = !enable || currentPatientHistory.length === 0;
        if (addNewPrescriptionBtn.disabled) {
            addNewPrescriptionBtn.style.backgroundColor = '#6c757d';
            addNewPrescriptionBtn.style.cursor = 'not-allowed';
        } else {
            addNewPrescriptionBtn.style.backgroundColor = '#28a745';
            addNewPrescriptionBtn.style.cursor = 'pointer';
        }
    }
}

async function updatePatientDetails() {
    const mobileInput = document.getElementById('pMobile');
    const mobileValue = mobileInput.value.trim();
    const nameValue = document.getElementById('pName').value.trim();
    const ageValue = document.getElementById('pAge').value.trim();
    const sexValue = document.getElementById('pSex').value;
    
    const isDuplicate = await checkMobileDuplicate();
    if (isDuplicate) {
        // The warning is already shown by checkMobileDuplicate
        // Show an additional alert for clarity
        showCustomAlert('Duplicate Mobile Number', 
            'This mobile number belongs to a different patient. Mobile numbers must be unique for each patient.', 
            'simple');
        return;
    }
    
    try {
        const result = await StorageManager.get(['history']);
        const history = result.history || [];
        if (editingIndex === null || editingIndex >= history.length) {
            showCustomAlert('Error', 'Cannot find the prescription to update.', 'error');
            return;
        }
        
        // Get the original patient details before update
        const originalItem = history[editingIndex];
        
        // Check if mobile number is being changed
        const mobileChanged = originalItem.pMobile !== mobileValue;
        
        if (mobileChanged) {
            // If mobile is being changed, we need to check if the NEW mobile number
            // conflicts with any other patient (excluding the current one)
            const isNewMobileDuplicate = checkNewMobileForOtherPatients(history, mobileValue, nameValue, ageValue, sexValue, editingIndex);
            
            if (isNewMobileDuplicate) {
                showCustomAlert('Duplicate Mobile Number', 
                    'This mobile number belongs to a different patient. Mobile numbers must be unique for each patient.', 
                    'simple');
                return;
            }
        }
        
        const updatedItem = {
            ...originalItem,
            pName: nameValue,
            pSex: sexValue,
            pAge: ageValue,
            pMobile: mobileValue,
            pDate: document.getElementById('pDate').value
        };
        
        history[editingIndex] = updatedItem;
        await StorageManager.set({ history: history });
        renderHistory();
        resetForm();
        showSuccessMessage('Patient Details Updated', 'Patient information has been updated successfully.');
    } catch (error) {
        console.error('Error updating patient details:', error);
        showCustomAlert('Error', 'Failed to update patient details.', 'error');
    }
}

async function updateOrCreatePrescription() {
    // Get current form data
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
    
    // Check if at least one medicine is added
    if (meds.length === 0) {
        showCustomAlert('No Medicines', 'Please add at least one medicine to the prescription.', 'simple');
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    const selectedPrescription = selectedPrescriptionIndex !== null ? currentPatientHistory[selectedPrescriptionIndex] : null;
    const selectedDate = selectedPrescription ? selectedPrescription.pDate : null;
    
    const prescriptionData = {
        pName: document.getElementById('pName').value,
        pSex: document.getElementById('pSex').value,
        pAge: document.getElementById('pAge').value,
        pMobile: document.getElementById('pMobile').value,
        pDate: today, // Always use today's date for new/updated prescriptions
        cc: document.getElementById('ccInput').value,
        oe: document.getElementById('oeInput').value,
        pulse: document.getElementById('pulseInput').value,
        bp: document.getElementById('bpInput').value,
        temp: document.getElementById('tempInput').value,
        inv: document.getElementById('invInput').value,
        meds: meds
    };
    
    try {
        const result = await StorageManager.get(['history']);
        let history = result.history || [];
        
        // Remove any empty entry for this patient (if exists)
        history = history.filter(item => 
            !(item.pMobile === prescriptionData.pMobile && 
              item.pName === prescriptionData.pName &&
              (!item.meds || !Array.isArray(item.meds) || item.meds.length === 0))
        );
        
        if (selectedDate === today && selectedPrescriptionIndex !== null && selectedPrescription) {
            // Update existing prescription if it's from today
            const originalIndex = history.findIndex(item => 
                item.pMobile === prescriptionData.pMobile &&
                item.pDate === selectedDate &&
                JSON.stringify(item.meds) === JSON.stringify(selectedPrescription.meds) &&
                item.cc === selectedPrescription.cc
            );
            
            if (originalIndex !== -1) {
                history[originalIndex] = prescriptionData;
            } else {
                history.unshift(prescriptionData);
            }
        } else {
            // Create new prescription
            history.unshift(prescriptionData);
        }
        
        await StorageManager.set({ history: history });
        renderHistory();
        resetForm();
        showSuccessMessage('Prescription Saved', 'Prescription has been saved successfully.');
        
        incrementPrescriptionCount();
    } catch (error) {
        console.error('Error saving prescription:', error);
        showCustomAlert('Error', 'Failed to save prescription.', 'error');
    }
}