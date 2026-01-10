// print-manager.js - Print and prescription generation functions (Web Compatible)

// ====== PRESCRIPTION SAVE/GENERATE ======
async function savePrescription() {
    if (editingMode === 'patient') {
        await updatePatientDetails();
        return;
    } else if (editingMode === 'prescription') {
        await updateOrCreatePrescription();
        return;
    }
    
    if (!validateRequiredFields()) {
        return; // Don't proceed if validation fails
    }
    
    const canSave = await checkPrescriptionLimit();
    if (!canSave) {
        openPaymentModal();
        return;
    }
    
    // First check if mobile number already exists for a different patient
    const isDuplicate = await checkMobileDuplicate();
    if (isDuplicate) {
        // Show the warning that's already displayed by checkMobileDuplicate
        // Also show an alert for better visibility
        showCustomAlert('Duplicate Mobile Number', 
            'This mobile number belongs to a different patient. Mobile numbers must be unique for each patient.', 
            'simple');
        return;
    }
    
    try {
        const result = await StorageManager.get(['prescriptionSettings']);
        const settings = result.prescriptionSettings || {};
        
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
            meds
        };
        
        // Save to history
        await saveToHistory(fullData);
        await incrementPrescriptionCount();
        resetForm();
        showSuccessMessage('Prescription Saved', `Prescription for "${pName}" has been saved successfully!`);
    } catch (error) {
        console.error('Error saving prescription:', error);
        showCustomAlert('Error', 'Failed to save prescription.', 'error');
    }
}

async function generatePrescription() {
    // First check if the user has exceeded the prescription limit
    const canGenerate = await checkPrescriptionLimit();
    if (!canGenerate) {
        openPaymentModal();
        return;
    }
    
    // Only validate required fields if we're actually generating a prescription
    if (!validateRequiredFields()) {
        return; // Don't proceed if validation fails
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
        const defaultLogoUrl = "assets/logo.png"; // Relative path for web
        const defaultSignatureUrl = "assets/sign.png"; // Relative path for web
        
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
        
        await saveToHistory(fullData);
        await incrementPrescriptionCount();
        const sanitizedName = pName.replace(/[\\/:*?"<>|]/g, '');
        const docTitle = `Prescription - ${sanitizedName} ${formattedDate}`;
        openPrintView([{...fullData, settings}], defaultLogoUrl, docTitle);
        resetForm();
    } catch (error) {
        console.error('Error generating prescription:', error);
        showCustomAlert('Error', 'Failed to generate prescription.', 'error');
    }
}

async function bulkPrintHistory() {
    const canGenerate = await checkPrescriptionLimit();
    if (!canGenerate) {
        openPaymentModal();
        return;
    }
    
    try {
        const result = await StorageManager.get(['history', 'prescriptionSettings']);
        const history = result.history || [];
        const settings = result.prescriptionSettings || {};
        const defaultLogoUrl = "assets/logo.png";
        const defaultSignatureUrl = "assets/sign.png";
        
        if (history.length === 0) {
            showCustomAlert('No Data', 'No patient history to print', 'info');
            return;
        }
        
        const currentDate = new Date();
        const formattedCurrentDate = `${currentDate.getDate().toString().padStart(2, '0')}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getFullYear()}`;
        const docTitle = `All Prescriptions ${formattedCurrentDate}`;
        const historyWithSettings = history.map(item => ({
            ...item,
            settings,
            defaultSignatureUrl
        }));
        openPrintView(historyWithSettings, defaultLogoUrl, docTitle);
        await incrementPrescriptionCount();
    } catch (error) {
        console.error('Error bulk printing:', error);
        showCustomAlert('Error', 'Failed to print history.', 'error');
    }
}

// ====== PRINT FUNCTIONS ======
function openPrintView(historyArray, defaultLogo, title) {
    const win = window.open("", "_blank");
    win.document.write(createPrintDocumentHTML(historyArray, defaultLogo, title));
    win.document.close();
}

async function openHistoryPrintView(item) {
    try {
        const result = await StorageManager.get(['prescriptionSettings']);
        const settings = result.prescriptionSettings || {};
        const defaultLogoUrl = "assets/logo.png";
        const defaultSignatureUrl = "assets/sign.png";
        const itemWithSignature = { ...item, defaultSignatureUrl };
        const formattedDate = formatDisplayDate(item.pDate);
        const sanitizedName = item.pName; 
        const docTitle = `Prescription - ${sanitizedName} ${formattedDate}`;
        openPrintView([{...itemWithSignature, settings}], defaultLogoUrl, docTitle);
    } catch (error) {
        console.error('Error opening history print view:', error);
        showCustomAlert('Error', 'Failed to open print view.', 'error');
    }
}

function createPrintDocumentHTML(historyArray, defaultLogo, title) {
    let pagesHtml = historyArray.map(item => {
        const itemSettings = item.settings || {};
        return `<div class="page-container">${createPrescriptionPageHTML(item, defaultLogo, itemSettings)}</div>`;
    }).join('');
    
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        @page { size: A4; margin: 0; }
        body { margin: 0; padding: 0; background: #eee; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;}
        .page-container { background: white; width: 210mm; min-height: 297mm; margin: 20px auto; box-shadow: 0 0 10px rgba(0,0,0,0.1); overflow: hidden; page-break-after: always; position: relative; }
        @media print {
            body { background: none; margin: 0; }
            .page-container { margin: 0; box-shadow: none; border: none; page-break-inside: avoid; }
            .no-print { display: none !important; }
            a[href]:after { content: none !important; }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
    </style>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            try {
                document.title = "${title}";
                const printBtn = document.createElement('div');
                printBtn.className = 'no-print';
                printBtn.style.cssText = 'position: fixed; top: 10px; left: 10px; background: #0056b3; color: white; padding: 10px; border-radius: 5px; z-index: 10000;';
                printBtn.innerHTML = '<button onclick="window.print()" style="background: white; color: #0056b3; border: none; padding: 5px 15px; border-radius: 3px; 
                    cursor: pointer; font-weight: bold; margin-right: 10px;">Print Prescription</button>
                    <button onclick="window.close()" style="background: #dc3545; color: white; border: none; padding: 5px 15px; border-radius: 3px; cursor: pointer;">Close Window</button>';
                document.body.appendChild(printBtn);
            } catch(e) { console.error('Error setting up print:', e); }
        });
    </script>
</head>
<body>${pagesHtml}</body>
</html>`;
}

// MERGE QUANTITY AND UNIT
function formatUnitDisplay(qty, unit) {
    if (qty && qty.trim() && unit && unit.trim()) {
        return `${qty}${unit}`;
    } else if (qty && qty.trim()) {
        return qty;
    } else if (unit && unit.trim()) {
        return unit;
    }
    return '';
}

function createPrescriptionPageHTML(data, defaultLogo, settings = {}) {
    const doctorName = settings.doctorName || "Dr. Arif Aziz";
    const doctorQualification = settings.doctorQualification || "MBBS [Dhaka (DU)], General Practitioner";
    const doctorRegNumber = settings.doctorRegNumber || "B.M & D.C Reg. No: [Available upon request]";
    const doctorExperience = settings.doctorExperience || "Experienced in Conventional Medicine, Hijama & Lifestyle Modification";
    const hospitalName = settings.hospitalName || "DOCTOR'S NEST";
    const appointmentContact = settings.appointmentContact || "+8801521101236";
    const clinicAddress = settings.clinicAddress || "";
    const watermarkOpacity = settings.watermarkOpacity || 8;
    const hospitalFontSize = settings.hospitalFontSize || 36;
    const headerLogo = settings.headerLogoData || defaultLogo;
    const watermarkLogo = settings.watermarkLogoData || defaultLogo;
    const customSignatureData = settings.signatureData || null;
    const defaultSignatureUrl = data.defaultSignatureUrl || "assets/sign.png";
    const signatureToUse = customSignatureData || defaultSignatureUrl;
    const hasValidSignature = signatureToUse && signatureToUse !== '';
    
    let invHtml = 'N/A';
    if (data.inv) {
        const lines = data.inv.split('\n').filter(l => l.trim() !== '');
        invHtml = `<ol style="margin:0; padding-left:18px; font-size:14px; font-family: 'Times New Roman', Times, serif;">${lines.map(l => `<li>${l}</li>`).join('')}</ol>`;
    }
    
    // Build the medicine table with conditional columns
    let medRows = '';
    let columnHeaders = '<th align="left" style="width: 30%;">Medicine</th>';
    let showUnitColumn = false;
    let showDoseColumn = false;
    let showFreqColumn = false;
    let showDaysColumn = false;
    let showMealColumn = false;
    let showNoteColumn = false;
    
    // Check which columns have data
    if (data.meds && Array.isArray(data.meds)) {
        data.meds.forEach(m => {
            if ((m.qty && m.qty.trim()) || (m.unit && m.unit.trim())) showUnitColumn = true;
            if (m.dose && m.dose.trim()) showDoseColumn = true;
            if (m.freq && m.freq.trim()) showFreqColumn = true;
            if (m.days && m.days.trim()) showDaysColumn = true;
            if (m.meal && m.meal.trim()) showMealColumn = true;
            if (m.inst && m.inst.trim()) showNoteColumn = true;
        });
        
        // Build column headers based on which columns have data
        if (showUnitColumn) columnHeaders += '<th align="center" style="width: 10%;">Unit</th>';
        if (showDoseColumn) columnHeaders += '<th align="center" style="width: 10%;">Dose</th>';
        if (showFreqColumn) columnHeaders += '<th align="center" style="width: 10%;">Freq</th>';
        if (showDaysColumn) columnHeaders += '<th align="center" style="width: 8%;">Days</th>';
        if (showMealColumn) columnHeaders += '<th align="center" style="width: 12%;">Meal</th>';
        if (showNoteColumn) columnHeaders += '<th align="center" style="width: 28%; min-width: 150px; max-width: 200px;">Note</th>';
        
        // Build medicine rows
        medRows = data.meds.map(m => {
            let rowCells = `<td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: left; vertical-align: center;"><strong>${m.name}</strong></td>`;
            
            // Unit column (Quantity + Unit)
            if (showUnitColumn) {
                const unitDisplay = formatUnitDisplay(m.qty, m.unit);
                rowCells += `<td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: center; vertical-align: center;">${unitDisplay || '-'}</td>`;
            }
            if (showDoseColumn) {
                rowCells += `<td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: center; vertical-align: center;">${m.dose || '-'}</td>`;
            }
            if (showFreqColumn) {
                rowCells += `<td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: center; vertical-align: center;">${m.freq || '-'}</td>`;
            }
            if (showDaysColumn) {
                rowCells += `<td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: center; vertical-align: center;">${m.days || '-'}</td>`;
            }
            if (showMealColumn) {
                rowCells += `<td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: center; vertical-align: center;">${m.meal || ''}</td>`;
            }
            if (showNoteColumn) {
                const noteContent = m.inst && m.inst.trim() !== "" ? m.inst : '-';
                const alignment = noteContent === '-' ? 'center' : 'left';
                
                // Add extra padding-left only if it's left-aligned text
                const paddingLeft = alignment === 'left' ? '6px' : '0';

                rowCells += `
                    <td style="
                        padding: 8px ${paddingLeft}; 
                        border-bottom: 1px solid #eee; 
                        text-align: ${alignment}; 
                        vertical-align: center; 
                        word-wrap: break-word; 
                        white-space: normal; 
                        font-size: 11px;
                        font-style: italic;                        
                        line-height: 1.2;
                    ">${noteContent}</td>`;
            }
            
            return `<tr style="font-family: 'Times New Roman', Times, serif; font-size: 14px;">${rowCells}</tr>`;
        }).join('');
    }
    
    return `
    <div style="width: 210mm; height: 297mm; padding: 45px; box-sizing: border-box; 
                display: flex; flex-direction: column; position: relative; background: white;">
        <img src="${watermarkLogo}" style="position: absolute; top: 50%; left: 50%; 
             transform: translate(-50%, -50%); opacity: ${watermarkOpacity / 100}; width: 60%; z-index: 0;">
        <div style="display: flex; justify-content: space-between; border-bottom: 4px solid #0056b3; 
                    padding-bottom: 10px; z-index: 1;">
            <div>
                <h1 style="margin:0; color:#0056b3; font-size: 30px; font-family: Arial;">${doctorName}</h1>
                <p style="margin:2px 0; color:#932F67; font-size: 13px; font-weight: bold;">${doctorQualification}</p>
                <p style="margin:2px 0; color:#213448; font-size: 14px; font-weight: 450; font-family:serif;">${doctorRegNumber}</p>
                <p style="margin:2px 0; font-size: 10px; color:#0056b3; font-style: italic;">${doctorExperience}</p>
            </div>
            <img src="${headerLogo}" style="height: 75px; max-width: 150px; object-fit: contain;">
        </div>
        <div style="padding: 15px 0; border-bottom: 1px solid #eee; z-index: 1; font-size: 14px; display: flex; justify-content: space-between; font-family: 'Times New Roman', Times, serif;">
            <span><strong>Patient:</strong> ${data.pName}</span>
            <span><strong>Age:</strong> ${data.pAge}</span>
            <span><strong>Sex:</strong> ${data.pSex}</span>
            <span><strong>Mobile:</strong> ${data.pMobile}</span>
            <span><strong>Date:</strong> ${formatDisplayDate(data.pDate)}</span>
        </div>
        <div style="display: flex; flex: 1; margin-top: 25px; z-index: 1;">
            <div style="width: 28%; border-right: 1.5px solid #0056b3; padding-right: 20px; font-family: 'Times New Roman', Times, serif;">
                <h4 style="color:#0056b3; margin: 0 0 5px 0;">C/C:</h4>
                <p style="font-size:14px; margin:0 0 15px 0; min-height: 40px;">${data.cc || 'N/A'}</p>
                <h4 style="color:#0056b3; margin: 0 0 5px 0;">O/E:</h4>
                <p style="font-size:14px; margin:0 0 15px 0; min-height: 40px;">${data.oe || 'N/A'}</p>
                <h4 style="color:#0056b3; margin: 0 0 5px 0;">Vitals:</h4>
                <p style="font-size:14px; margin:0 0 15px 0;">
                    BP: ${data.bp || '-'}<br>
                    Pulse: ${data.pulse || '-'}<br>
                    Temperature: ${data.temp || data.rbs || '-'}
                </p>
                <h4 style="color:#0056b3; margin: 0 0 5px 0;">Investigation:</h4>
                <div>${invHtml}</div>
            </div>
            <div style="width: 72%; padding-left: 25px; display: flex; flex-direction: column; 
                        font-family: 'Times New Roman', Times, serif;">
                <h2 style="color:#0056b3; margin: 0 0 10px 0; font-size: 40px; 
                          font-family: Georgia; font-style: italic;">Rx</h2>
                
                <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                    <thead>
                        <tr style="border-bottom: 1.5px solid #0056b3; color:#0056b3; font-family: Arial; font-size: 13px;">
                            ${columnHeaders}
                        </tr>
                    </thead>
                    <tbody>
                        ${medRows || '<tr><td colspan="7" style="text-align: center; padding: 20px;">No medicines prescribed</td></tr>'}
                    </tbody>
                </table>
                
                <div style="margin-top: auto; text-align: right; padding-bottom: 20px;">
                    <div style="display: inline-block; padding-top: 5px; margin-bottom: 5px;">
                        ${hasValidSignature ? `<img src="${signatureToUse}" style="max-width: 170px; max-height: 60px; display: block; margin-bottom: 2px;">` : ''}
                        <div style="border-top: 1px solid #0056b3; width: 170px; padding-top: 5px; 
                             font-weight: bold; font-size: 14px; text-align: center;">Doctor's Signature</div>
                    </div>
                </div>
            </div>
        </div>
        <div style="border-top: 1px solid #0056b3; padding-top: 10px; text-align: center; 
                    z-index: 1; line-height: 1.4;">
            <div style="color: #0056b3; font-weight: 800; font-size: ${hospitalFontSize}px; 
                 text-transform: uppercase; margin-bottom: 8px; letter-spacing: 1px;">${hospitalName}</div>
            ${clinicAddress ? `<div style="font-size: 14px; color: #333; margin: 6px 0; line-height: 1.5;">${clinicAddress}</div>` : ''}
            <div style="font-size: 14px; color: #333; margin: 6px 0;">Please call for appointment: ${appointmentContact}</div>
            ${settings.doctorEmail ? `<div style="font-size: 14px; color: #333; margin: 6px 0;">Email: ${settings.doctorEmail}</div>` : ''}
        </div>
    </div>`;
}

// ====== UTILITY FUNCTIONS ======
function formatDisplayDate(dateStr) {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
}