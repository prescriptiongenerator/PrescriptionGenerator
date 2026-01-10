// settings-manager.js - Settings modal functions (Web Compatible)

// ====== SETTINGS MODAL ======
function openSettings() {
    document.getElementById('settingsModal').style.display = 'flex';
    loadSettingsIntoModal();
    updateDatabaseUI();
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

async function loadSettings() {
    try {
        const result = await StorageManager.get(['prescriptionSettings']);
        if (!result.prescriptionSettings) {
            const defaultSettings = {
                doctorName: "Dr. Arif Aziz",
                doctorQualification: "MBBS [Dhaka (DU)], General Practitioner",
                doctorRegNumber: "B.M & D.C Reg. No: [Available upon request]",
                doctorExperience: "Experienced in Conventional Medicine, Hijama & Lifestyle Modification",
                hospitalName: "DOCTOR'S NEST",
                appointmentContact: "+8801521101236",
                doctorEmail: "",
                clinicAddress: "",
                watermarkOpacity: 8,
                hospitalFontSize: 36,
            };
            await StorageManager.set({ prescriptionSettings: defaultSettings });
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function loadSettingsIntoModal() {
    try {
        const result = await StorageManager.get(['prescriptionSettings']);
        const settings = result.prescriptionSettings || {};
        document.getElementById('doctorName').value = settings.doctorName || "Dr. Arif Aziz";
        document.getElementById('doctorQualification').value = settings.doctorQualification || "MBBS [Dhaka (DU)], General Practitioner";
        document.getElementById('doctorRegNumber').value = settings.doctorRegNumber || "B.M & D.C Reg. No: [Available upon request]";
        document.getElementById('doctorExperience').value = settings.doctorExperience || "Experienced in Conventional Medicine, Hijama & Lifestyle Modification";
        document.getElementById('hospitalName').value = settings.hospitalName || "DOCTOR'S NEST";
        document.getElementById('appointmentContact').value = settings.appointmentContact || "+8801521101236";
        document.getElementById('doctorEmail').value = settings.doctorEmail || "";
        document.getElementById('clinicAddress').value = settings.clinicAddress || "";
        document.getElementById('watermarkOpacity').value = settings.watermarkOpacity || 8;
        document.getElementById('opacityValue').textContent = `${settings.watermarkOpacity || 8}%`;
        document.getElementById('hospitalFontSize').value = settings.hospitalFontSize || 36;
        document.getElementById('fontSizeValue').textContent = `${settings.hospitalFontSize || 36}px`;
        
        if (settings.headerLogoData) document.getElementById('headerLogoPreview').src = settings.headerLogoData;
        if (settings.watermarkLogoData) document.getElementById('watermarkLogoPreview').src = settings.watermarkLogoData;
        
        const signaturePreview = document.getElementById('signaturePreview');
        if (settings.signatureData) {
            signaturePreview.src = settings.signatureData;
            signaturePreview.alt = "Custom Signature";
        } else {
            signaturePreview.src = "assets/sign.png";
            signaturePreview.alt = "Default Signature";
        }
        
        updatePresetStats();
        updatePreview();
        updateRemoveSignatureButton();
    } catch (error) {
        console.error('Error loading settings into modal:', error);
        showCustomAlert('Error', 'Failed to load settings.', 'error');
    }
}

async function saveSettings() {
    const settings = {
        doctorName: document.getElementById('doctorName').value || "Dr. Arif Aziz",
        doctorQualification: document.getElementById('doctorQualification').value || "MBBS [Dhaka (DU)], General Practitioner",
        doctorRegNumber: document.getElementById('doctorRegNumber').value || "B.M & D.C Reg. No: [Available upon request]",
        doctorExperience: document.getElementById('doctorExperience').value || "Experienced in Conventional Medicine, Hijama & Lifestyle Modification",
        hospitalName: document.getElementById('hospitalName').value || "DOCTOR'S NEST",
        appointmentContact: document.getElementById('appointmentContact').value || "+8801521101236",
        doctorEmail: document.getElementById('doctorEmail').value || "",
        clinicAddress: document.getElementById('clinicAddress').value || "",
        watermarkOpacity: parseInt(document.getElementById('watermarkOpacity').value) || 8,
        hospitalFontSize: parseInt(document.getElementById('hospitalFontSize').value) || 36,
    };
    
    const headerLogoPreview = document.getElementById('headerLogoPreview');
    const watermarkLogoPreview = document.getElementById('watermarkLogoPreview');
    const signaturePreview = document.getElementById('signaturePreview');
    
    if (headerLogoPreview.src && !headerLogoPreview.src.includes('flaticon.com')) {
        settings.headerLogoData = headerLogoPreview.src;
    }
    if (watermarkLogoPreview.src && !watermarkLogoPreview.src.includes('flaticon.com')) {
        settings.watermarkLogoData = watermarkLogoPreview.src;
    }
    if (signaturePreview.src && !signaturePreview.src.includes('sign.png')) {
        settings.signatureData = signaturePreview.src;
    }
    
    try {
        await StorageManager.set({ prescriptionSettings: settings });
        showSuccessMessage('Settings Saved', 'Your prescription settings have been saved successfully!');
        closeSettings();
    } catch (error) {
        console.error('Error saving settings:', error);
        showCustomAlert('Error', 'Failed to save settings.', 'error');
    }
}

// ====== LOGO & SIGNATURE HANDLING ======
function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => document.getElementById('headerLogoPreview').src = e.target.result;
        reader.readAsDataURL(file);
    }
}

function handleWatermarkUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            const preview = document.getElementById('watermarkLogoPreview');
            preview.src = e.target.result;
            preview.style.opacity = document.getElementById('watermarkOpacity').value / 100;
        };
        reader.readAsDataURL(file);
    }
}

function handleSignatureUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            const signaturePreview = document.getElementById('signaturePreview');
            signaturePreview.src = e.target.result;
            signaturePreview.alt = "Custom Signature";
            updatePreview();
            updateRemoveSignatureButton();
        };
        reader.readAsDataURL(file);
    }
}

function removeSignature() {
    const signaturePreview = document.getElementById('signaturePreview');
    signaturePreview.src = "assets/sign.png";
    signaturePreview.alt = "Default Signature";
    document.getElementById('signatureInput').value = '';
    updatePreview();
    updateRemoveSignatureButton();
}

function updateRemoveSignatureButton() {
    const signaturePreview = document.getElementById('signaturePreview');
    const removeBtn = document.getElementById('removeSignatureBtn');
    removeBtn.disabled = signaturePreview.src.includes("sign.png");
}

function updateOpacityPreview() {
    const opacity = document.getElementById('watermarkOpacity').value;
    document.getElementById('opacityValue').textContent = `${opacity}%`;
    const preview = document.getElementById('watermarkLogoPreview');
    if (preview.src) preview.style.opacity = opacity / 100;
}

function updateFontSizePreview() {
    const fontSize = document.getElementById('hospitalFontSize').value;
    document.getElementById('fontSizeValue').textContent = `${fontSize}px`;
}

function updatePreview() {
    const doctorName = document.getElementById('doctorName').value || "Dr. Arif Aziz";
    const qualification = document.getElementById('doctorQualification').value || "MBBS [Dhaka (DU)], General Practitioner";
    const hospitalName = document.getElementById('hospitalName').value || "DOCTOR'S NEST";
    const contact = document.getElementById('appointmentContact').value || "+8801521101236";
    const signaturePreview = document.getElementById('signaturePreview');
    const isDefaultSignature = signaturePreview.src.includes("sign.png");
    
    document.getElementById('previewDoctorName').textContent = doctorName;
    document.getElementById('previewQualifications').textContent = qualification;
    document.getElementById('previewHospitalName').textContent = hospitalName;
    document.getElementById('previewContact').textContent = contact;
    
    const signatureStatus = document.getElementById('previewSignatureStatus');
    if (!isDefaultSignature && signaturePreview.src) {
        signatureStatus.textContent = 'Custom signature uploaded';
        signatureStatus.style.color = '#28a745';
    } else {
        signatureStatus.textContent = 'Default signature will be used';
        signatureStatus.style.color = '#0056b3';
    }
}