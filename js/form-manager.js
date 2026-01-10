// form-manager.js - Form handling, validation, and medicine table functions (Web Compatible)

// ====== FORM FUNCTIONS ======
async function resetForm() {
    editingIndex = null;
    currentPatientHistory = [];
    document.getElementById('pName').value = '';
    document.getElementById('pSex').value = 'Male';
    document.getElementById('pAge').value = '';
    document.getElementById('pMobile').value = ''; 
    document.getElementById('pDate').value = new Date().toISOString().split('T')[0];
    
    ['pName', 'pAge', 'pMobile', 'ccInput', 'oeInput', 'pulseInput', 'bpInput', 'tempInput', 'invInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    
    document.getElementById('medBody').innerHTML = '';
    
    // Reset prescription UI to default state
    resetPrescriptionUI();
    
    // Add one empty medicine row
    addMedicineRow();
    
    setEditMode(null);
    document.getElementById('mobileWarning').style.display = 'none';
    currentPatientHistory = [];
    selectedPrescriptionIndex = null;
    
    // Reset preset dropdown
    document.getElementById('loadPresetDropdown').value = '';
    
    // Update preset button state
    updateSavePresetButtonState();
}

function addMedicineRow(data = null) {
    const tbody = document.getElementById('medBody');
    const row = document.createElement('tr');
    row.className = 'med-row';
    
    const rowId = Date.now(); // Unique ID for this row
    
    row.innerHTML = `
        <td>
            <input type="text" class="mName med-input medicine-autocomplete" 
                   placeholder="Search medicine..." 
                   value="${data ? data.name : ''}"
                   data-row="${rowId}"
                   list="medicine-list-${rowId}"
                   autocomplete="off">
            <datalist id="medicine-list-${rowId}"></datalist>
        </td>
        <td><input type="text" class="mQty med-input centered-input" placeholder="Qty" value="${data ? data.qty : ''}"></td>
        <td>
            <select class="mUnit med-input centered-input">
                <option value="" ${!data?.unit ? 'selected' : ''}>-</option>
                <option value="mg" ${data?.unit === 'mg' ? 'selected' : ''}>mg</option>
                <option value="ml" ${data?.unit === 'ml' ? 'selected' : ''}>ml</option>
                <option value="gm" ${data?.unit === 'gm' ? 'selected' : ''}>gm</option>
            </select>
        </td>
        <td>
            <select class="mDose med-input centered-input">
                <option value="" ${!data?.dose ? 'selected' : ''}>-</option>
                <option value="0+0+1" ${data?.dose === '0+0+1' ? 'selected' : ''}>0+0+1</option>
                <option value="0+1+0" ${data?.dose === '0+1+0' ? 'selected' : ''}>0+1+0</option>
                <option value="0+1+1" ${data?.dose === '0+1+1' ? 'selected' : ''}>0+1+1</option>
                <option value="1+0+0" ${data?.dose === '1+0+0' ? 'selected' : ''}>1+0+0</option>
                <option value="1+0+1" ${data?.dose === '1+0+1' ? 'selected' : ''}>1+0+1</option>
                <option value="1+1+0" ${data?.dose === '1+1+0' ? 'selected' : ''}>1+1+0</option>
                <option value="1+1+1" ${data?.dose === '1+1+1' ? 'selected' : ''}>1+1+1</option>
            </select>
        </td>
        <td>
            <select class="mFreq med-input centered-input">
                <option value="" ${!data?.freq ? 'selected' : ''}>-</option>
                <option value="Daily" ${data?.freq === 'Daily' ? 'selected' : ''}>Daily</option>
                <option value="Weekly" ${data?.freq === 'Weekly' ? 'selected' : ''}>Weekly</option>
                <option value="Monthly" ${data?.freq === 'Monthly' ? 'selected' : ''}>Monthly</option>
                <option value="3hrs" ${data?.freq === '3hrs' ? 'selected' : ''}>3hrs</option>
                <option value="4hrs" ${data?.freq === '4hrs' ? 'selected' : ''}>4hrs</option>
                <option value="6hrs" ${data?.freq === '6hrs' ? 'selected' : ''}>6hrs</option>
                <option value="8hrs" ${data?.freq === '8hrs' ? 'selected' : ''}>8hrs</option>
                <option value="12hrs" ${data?.freq === '12hrs' ? 'selected' : ''}>12hrs</option>
            </select>
        </td>
        <td><input type="text" class="mDays med-input centered-input" placeholder="Days" value="${data ? data.days : ''}"></td>
        <td>
            <select class="mMeal med-input centered-input">
                <option value="" ${!data?.meal ? 'selected' : ''}>-</option>
                <option value="After Meal" ${data?.meal === 'After Meal' ? 'selected' : ''}>After</option>
                <option value="Before Meal" ${data?.meal === 'Before Meal' ? 'selected' : ''}>Before</option>
            </select>
        </td>
        <td><input type="text" class="mInst med-input centered-input" placeholder="Instruction" value="${data ? data.inst : ''}"></td>
        <td><button class="btn-remove">-</button></td>
    `;
    
    tbody.appendChild(row);
    
    // Setup medicine input listeners
    setupMedicineInputListeners(row, rowId);
}

function setupMedicineInputListeners(row, rowId) {
    // Remove button functionality
    row.querySelector('.btn-remove').onclick = () => {
        row.remove();
        updateSavePresetButtonState();
    };
    
    // Add autocomplete functionality
    const medicineInput = row.querySelector('.mName');
    const datalist = row.querySelector(`#medicine-list-${rowId}`);
    
    let lastSearchTerm = '';
    
    medicineInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        
        if (searchTerm === lastSearchTerm || searchTerm.length < 1) {
            return;
        }
        
        lastSearchTerm = searchTerm;
        datalist.innerHTML = '';
        
        if (searchTerm.length > 1 && medicineDatabase.length > 0) {
            const suggestions = medicineDatabase
                .filter(med => med.name.toLowerCase().includes(searchTerm))
                .slice(0, 10);
            
            suggestions.forEach(med => {
                const option = document.createElement('option');
                option.value = med.name;
                option.setAttribute('data-quantity', med.quantity);
                option.setAttribute('data-unit', med.unit);
                option.setAttribute('data-dose', med.dose);
                option.setAttribute('data-frequency', med.frequency);
                option.setAttribute('data-days', med.days);
                option.setAttribute('data-meal', med.meal);
                option.setAttribute('data-note', med.note);
                datalist.appendChild(option);
            });
        }
    });
    
    // Add click event to handle option selection
    medicineInput.addEventListener('click', function() {
        // Show suggestions when clicking on empty field
        if (this.value === '' && medicineDatabase.length > 0) {
            const suggestions = medicineDatabase.slice(0, 5);
            datalist.innerHTML = '';
            
            suggestions.forEach(med => {
                const option = document.createElement('option');
                option.value = med.name;
                option.setAttribute('data-quantity', med.quantity);
                option.setAttribute('data-unit', med.unit);
                option.setAttribute('data-dose', med.dose);
                option.setAttribute('data-frequency', med.frequency);
                option.setAttribute('data-days', med.days);
                option.setAttribute('data-meal', med.meal);
                option.setAttribute('data-note', med.note);
                datalist.appendChild(option);
            });
        }
    });
    
    // Autofill when option is selected
    medicineInput.addEventListener('change', function() {
        const selectedOption = Array.from(datalist.options).find(opt => opt.value === this.value);
        if (selectedOption) {
            const quantity = selectedOption.getAttribute('data-quantity');
            const unit = selectedOption.getAttribute('data-unit');
            const dose = selectedOption.getAttribute('data-dose');
            const frequency = selectedOption.getAttribute('data-frequency');
            const days = selectedOption.getAttribute('data-days');
            let meal = selectedOption.getAttribute('data-meal');
            const note = selectedOption.getAttribute('data-note');
            
            // Auto-fill all fields
            if (quantity) row.querySelector('.mQty').value = quantity;
            if (unit) row.querySelector('.mUnit').value = unit;
            if (dose) row.querySelector('.mDose').value = dose;
            if (frequency) row.querySelector('.mFreq').value = frequency;
            if (days) row.querySelector('.mDays').value = days;
            
            // Special handling for meal field
            if (meal) {
                meal = meal.trim();
                const mealSelect = row.querySelector('.mMeal');
                
                if (meal.toLowerCase().includes('after') || meal === 'After') {
                    mealSelect.value = 'After Meal';
                } else if (meal.toLowerCase().includes('before') || meal === 'Before') {
                    mealSelect.value = 'Before Meal';
                } else if (meal.toLowerCase().includes('with') || meal === 'With') {
                    mealSelect.value = 'With Meal';
                } else if (meal.toLowerCase().includes('empty') || meal === 'Empty') {
                    mealSelect.value = 'Empty Stomach';
                } else {
                    const options = Array.from(mealSelect.options);
                    const matchingOption = options.find(opt => opt.value.toLowerCase() === meal.toLowerCase());
                    if (matchingOption) {
                        mealSelect.value = matchingOption.value;
                    }
                }
            }
            
            if (note) row.querySelector('.mInst').value = note;
            
            // Clear datalist immediately after selection
            datalist.innerHTML = '';
            setTimeout(() => medicineInput.blur(), 10);
        }
    });
    
    // Add input listeners for preset button state
    row.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('input', updateSavePresetButtonState);
    });
    
    // Add blur event to clear datalist when leaving the field
    medicineInput.addEventListener('blur', function() {
        setTimeout(() => {
            datalist.innerHTML = '';
        }, 200);
    });
    
    // Add keydown event to handle Enter key
    medicineInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const selectedOption = Array.from(datalist.options).find(opt => opt.value === this.value);
            if (selectedOption) {
                this.dispatchEvent(new Event('change'));
                e.preventDefault();
            }
        }
    });
}

// ====== MOBILE VALIDATION ======
async function checkMobileDuplicate() {
    const mobileInput = document.getElementById('pMobile');
    const nameInput = document.getElementById('pName');
    const ageInput = document.getElementById('pAge');
    const sexInput = document.getElementById('pSex');
    
    const mobileValue = mobileInput.value.trim();
    const nameValue = nameInput.value.trim();
    const ageValue = ageInput.value.trim();
    const sexValue = sexInput.value;
    
    const warningElement = document.getElementById('mobileWarning');
    
    mobileInput.style.border = ''; 
    mobileInput.style.backgroundColor = '';
    if (warningElement) warningElement.style.display = 'none';
    
    if (!mobileValue || mobileValue.length < 10) return false;
    
    try {
        const result = await StorageManager.get(['history']);
        const history = result.history || [];
        let isDuplicate = false;
        
        for (let i = 0; i < history.length; i++) {
            if (i === editingIndex) continue; // Skip current record if editing
            
            const entry = history[i];
            
            // Check if mobile number matches
            if (entry.pMobile && entry.pMobile.trim() === mobileValue) {
                // Check if patient details (name, age, sex) also match
                const nameMatches = entry.pName && entry.pName.trim().toLowerCase() === nameValue.toLowerCase();
                const ageMatches = entry.pAge && entry.pAge.toString().trim() === ageValue.toString().trim();
                const sexMatches = entry.pSex && entry.pSex === sexValue;
                
                if (!nameMatches || !ageMatches || !sexMatches) {
                    // Different patient with same mobile number - NOT ALLOWED
                    isDuplicate = true;
                    break;
                } else {
                    // Same patient - ALLOWED (can have multiple prescriptions)
                    isDuplicate = false;
                    break;
                }
            }
        }
        
        if (isDuplicate) {
            mobileInput.style.setProperty('border', '2px solid #dc3545', 'important');
            mobileInput.style.backgroundColor = '#fff8f8';
            if (warningElement) {
                warningElement.style.display = 'block';
                warningElement.textContent = '⚠️ Mobile number belongs to a different patient!';
            }
        } else {
            mobileInput.style.border = '';
            mobileInput.style.backgroundColor = '';
            if (warningElement) warningElement.style.display = 'none';
        }
        
        return isDuplicate;
    } catch (error) {
        console.error('Error checking mobile duplicate:', error);
        return false;
    }
}

function checkNewMobileForOtherPatients(history, newMobile, currentName, currentAge, currentSex, currentIndex) {
    for (let i = 0; i < history.length; i++) {
        if (i === currentIndex) continue;
        
        const entry = history[i];
        if (entry.pMobile && entry.pMobile.trim() === newMobile) {
            // Check if it's a different patient
            const nameMatches = entry.pName && entry.pName.trim().toLowerCase() === currentName.toLowerCase();
            const ageMatches = entry.pAge && entry.pAge.toString().trim() === currentAge.toString().trim();
            const sexMatches = entry.pSex && entry.pSex === currentSex;
            
            if (!nameMatches || !ageMatches || !sexMatches) {
                return true; // Different patient with same mobile - NOT ALLOWED
            }
        }
    }
    return false; // No conflict found
}

// ====== VALIDATION FUNCTION ======
function validateRequiredFields() {
    const pName = document.getElementById('pName').value.trim();
    const pAge = document.getElementById('pAge').value.trim();
    const pMobile = document.getElementById('pMobile').value.trim();
    
    if (!(pName && pAge && pMobile)) {
        showCustomAlert('Missing Information', 'Please Enter Patient All Information.', 'simple');
        return false;
    }
    
    if (!pName) {
        showCustomAlert('Missing Information', 'Please Enter Patient Name.', 'simple');
        return false;
    }
    
    if (!pAge) {
        showCustomAlert('Missing Information', 'Please Enter Patient Age.', 'simple');
        return false;
    }
    
    if (!pMobile) {
        showCustomAlert('Missing Information', 'Please Enter Mobile Number.', 'simple');
        return false;
    }
    
    return true;
}

// ====== NEW PRESCRIPTION FUNCTION ======
function addNewPrescription() {
    // Clear the medicine table
    document.getElementById('medBody').innerHTML = '';
    // Add one empty row
    addMedicineRow();
    // Reset dropdown selection
    document.getElementById('previousPrescriptionsDropdown').value = '';
    selectedPrescriptionIndex = null;
    
    // Update button states
    updateNewPrescriptionButtonState();
}