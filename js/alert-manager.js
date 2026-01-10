// alert-manager.js - Alert and modal management (Web Compatible)

// ====== ALERT SYSTEM ======
function showCustomAlert(title, message, type = 'warning', patientName = '') {
    return new Promise((resolve, reject) => {
        window.alertResolve = resolve;
        window.alertReject = reject;
        const modal = document.getElementById('customAlertModal');
        const alertTitle = document.getElementById('alertTitle');
        const alertMessage = document.getElementById('alertMessage');
        const alertIcon = document.getElementById('alertIcon');
        const alertBigIcon = document.getElementById('alertBigIcon');
        const confirmBtn = document.getElementById('alertConfirmBtn');
        const cancelBtn = document.getElementById('alertCancelBtn');
        
        alertTitle.textContent = title;
        
        switch(type) {
            case 'delete':
                alertIcon.innerHTML = '🗑️';
                alertBigIcon.innerHTML = '🗑️';
                alertBigIcon.style.color = '#dc3545';
                confirmBtn.style.background = 'linear-gradient(135deg, #dc3545, #c82333)';
                confirmBtn.textContent = 'Yes, Delete';
                cancelBtn.style.display = 'inline-block';
                if (patientName) {
                    alertMessage.innerHTML = `<strong style="color: #721c24; font-size: 17px;">Patient: ${patientName}</strong><br><br>This action is permanent and cannot be undone.<br>All prescription data will be lost forever.`;
                } else {
                    alertMessage.innerHTML = `This action is permanent and cannot be undone.<br>All prescription data will be lost forever.`;
                }
                break;
            case 'simple':
                alertIcon.innerHTML = '⚠️';
                alertBigIcon.innerHTML = '⚠️';
                alertBigIcon.style.color = '#ffc107';
                confirmBtn.style.background = 'linear-gradient(135deg, #0056b3, #004085)';
                confirmBtn.textContent = 'OK';
                cancelBtn.style.display = 'none';
                alertMessage.innerHTML = message;
                break;
            case 'warning':
                alertIcon.innerHTML = '⚠️';
                alertBigIcon.innerHTML = '⚠️';
                alertBigIcon.style.color = '#ffc107';
                confirmBtn.style.background = 'linear-gradient(135deg, #ffc107, #e0a800)';
                confirmBtn.textContent = 'Yes';
                cancelBtn.style.display = 'inline-block';
                alertMessage.innerHTML = message;
                break;
            case 'info':
                alertIcon.innerHTML = 'ℹ️';
                alertBigIcon.innerHTML = 'ℹ️';
                alertBigIcon.style.color = '#0056b3';
                confirmBtn.style.background = 'linear-gradient(135deg, #0056b3, #004085)';
                confirmBtn.textContent = 'OK';
                cancelBtn.style.display = 'none';
                alertMessage.innerHTML = message;
                break;
            case 'success':
                alertIcon.innerHTML = '✅';
                alertBigIcon.innerHTML = '✅';
                alertBigIcon.style.color = '#28a745';
                confirmBtn.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
                confirmBtn.textContent = 'OK';
                cancelBtn.style.display = 'none';
                alertMessage.innerHTML = message;
                break;
            case 'error':
                alertIcon.innerHTML = '❌';
                alertBigIcon.innerHTML = '❌';
                alertBigIcon.style.color = '#dc3545';
                confirmBtn.style.background = 'linear-gradient(135deg, #dc3545, #c82333)';
                confirmBtn.textContent = 'OK';
                cancelBtn.style.display = 'none';
                alertMessage.innerHTML = message;
                break;
        }
        
        modal.style.display = 'flex';
        modal.style.animation = 'fadeIn 0.3s ease-in-out';
    });
}

function showSuccessMessage(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('successModal');
        const successTitle = document.getElementById('successTitle');
        const successMessage = document.getElementById('successMessage');
        successTitle.textContent = title;
        successMessage.textContent = message;
        modal.style.display = 'flex';
        modal.style.animation = 'fadeIn 0.3s ease-in-out';
        setTimeout(() => { closeSuccessModal(); resolve(); }, 2000);
    });
}

function closeCustomAlert() {
    const modal = document.getElementById('customAlertModal');
    modal.style.animation = 'fadeOut 0.3s ease-in-out';
    setTimeout(() => {
        modal.style.display = 'none';
        if (window.alertReject) { 
            window.alertReject(); 
            window.alertResolve = null; 
            window.alertReject = null; 
        }
    }, 300);
}

function confirmCustomAlert() {
    const modal = document.getElementById('customAlertModal');
    modal.style.animation = 'fadeOut 0.3s ease-in-out';
    setTimeout(() => {
        modal.style.display = 'none';
        if (window.alertResolve) { 
            window.alertResolve(true); 
            window.alertResolve = null; 
            window.alertReject = null; 
        }
    }, 300);
}

function closeSuccessModal() {
    const modal = document.getElementById('successModal');
    modal.style.animation = 'fadeOut 0.3s ease-in-out';
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}