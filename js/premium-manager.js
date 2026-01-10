// premium-manager.js - Premium payment and unlock system (Web Compatible)

// ====== PREMIUM SYSTEM ======
async function verifyUnlockCode() {
    const unlockCodeInput = document.getElementById('unlockCode');
    const verifyBtn = document.getElementById('verifyUnlockCode');
    const unlockStatus = document.getElementById('unlockStatus');
    
    const code = unlockCodeInput.value.trim().toUpperCase();
    
    if (!code) {
        unlockStatus.textContent = "Please enter an activation code.";
        unlockStatus.className = "status-message status-error";
        unlockStatus.style.display = "block";
        return;
    }
    
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = "Verifying...";
    unlockStatus.textContent = "⏳ Connecting to verification server...";
    unlockStatus.className = "status-message status-info";
    unlockStatus.style.display = "block";
    
    try {
        // Note: This might have CORS issues on GitHub Pages
        // Consider using a proxy or alternative verification method
        const response = await fetch(`${GOOGLE_SHEETS_WEB_APP_URL}?code=${encodeURIComponent(code)}`);
        const result = await response.json();
        
        if (result.success) {
            // CASE 1: LIFETIME CODES
            if (result.type === "Lifetime") {
                await StorageManager.set({
                    isPremium: true,
                    premiumType: "Lifetime",
                    expiryDate: null,
                    prescriptionCount: 0,
                    prescriptionLimit: null,
                    usedCodes: [code],
                    premiumActivatedAt: new Date().toISOString()
                });
                
                unlockStatus.textContent = "✅ Lifetime Premium Activated! Unlimited access granted.";
                unlockStatus.className = "status-message status-success";
                verifyBtn.innerHTML = "Verified ✓";
                
                checkPremiumStatus();
                updateCounterDisplay();
                
                setTimeout(() => {
                    closePaymentModal();
                    showSuccessMessage('Premium Activated', 'Lifetime premium membership activated successfully!');
                }, 500);
            } 
            // CASE 2: TIME-BASED CODES (1 Month, 6 Months, 1 Year, etc.)
            else if (result.type.includes("Month") || result.type.includes("Year")) {
                let monthsToAdd = 0;
                if (result.type.includes("Month")) monthsToAdd = parseInt(result.type) || 1;
                if (result.type.includes("Year")) monthsToAdd = (parseInt(result.type) || 1) * 12;

                const expiry = new Date();
                expiry.setMonth(expiry.getMonth() + monthsToAdd);

                await StorageManager.set({
                    isPremium: true,
                    premiumType: result.type,
                    expiryDate: expiry.toISOString(),
                    prescriptionCount: 0,
                    prescriptionLimit: null,
                    usedCodes: [code],
                    premiumActivatedAt: new Date().toISOString()
                });
                
                // Success UI updates
                unlockStatus.textContent = `✅ ${result.type} Subscription Activated!`;
                unlockStatus.className = "status-message status-success";
                verifyBtn.innerHTML = "Verified ✓";
                
                checkPremiumStatus();
                updateCounterDisplay();
                
                // Close modal and show success popup after a short delay
                setTimeout(() => {
                    closePaymentModal();
                    showSuccessMessage('Premium Activated', `${result.type} membership activated successfully!`);
                }, 500);
            } 
            // CASE 3: COUNT-BASED CODES (Trial extensions)
            else if (result.type.includes("Trial") || !isNaN(parseInt(result.type))) {
                const match = result.type.match(/\d+/);
                const additionalPrescriptions = match ? parseInt(match[0]) : 10;
                
                const storageResult = await StorageManager.get(['prescriptionCount', 'prescriptionLimit']);
                const currentCount = storageResult.prescriptionCount || 0;
                const currentLimit = storageResult.prescriptionLimit || 2;
                const newLimit = currentLimit + additionalPrescriptions;
                
                await StorageManager.set({
                    isPremium: false,
                    prescriptionCount: currentCount,
                    prescriptionLimit: newLimit,
                    usedCodes: [code],
                    trialActivatedAt: new Date().toISOString()
                });
                
                unlockStatus.textContent = `✅ Added ${additionalPrescriptions} prescriptions! New limit: ${newLimit}`;
                unlockStatus.className = "status-message status-success";
                verifyBtn.innerHTML = "Verified ✓";
                
                setTimeout(() => {
                    checkPremiumStatus();
                    updateCounterDisplay();
                    closePaymentModal();
                    showSuccessMessage('Trial Extended', `Added ${additionalPrescriptions} prescriptions to your account!`);
                }, 500);
            } 
            // CASE 4: OTHER PREMIUM TYPES
            else {
                await StorageManager.set({
                    isPremium: true,
                    premiumType: result.type,
                    prescriptionCount: 0,
                    prescriptionLimit: null,
                    usedCodes: [code],
                    premiumActivatedAt: new Date().toISOString()
                });
                
                unlockStatus.textContent = `✅ ${result.type} Premium Activated!`;
                unlockStatus.className = "status-message status-success";
                verifyBtn.innerHTML = "Verified ✓";
                
                checkPremiumStatus();
                updateCounterDisplay();
                
                setTimeout(() => {
                    closePaymentModal();
                    showSuccessMessage('Premium Activated', `${result.type} premium membership activated successfully!`);
                }, 500);
            }
        } else {
            unlockStatus.textContent = `❌ ${result.message || "Invalid activation code."}`;
            unlockStatus.className = "status-message status-error";
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = "Verify & Unlock";
        }
    } catch (error) {
        console.error('Verification error:', error);
        unlockStatus.textContent = "❌ Network error. Please check your internet connection and try again.";
        unlockStatus.className = "status-message status-error";
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = "Verify & Unlock";
    }
}

async function checkPremiumStatus() {
    try {
        const result = await StorageManager.get(['isPremium', 'expiryDate', 'prescriptionLimit', 'premiumType']);
        if (result.isPremium && result.expiryDate) {
            const now = new Date();
            const expiry = new Date(result.expiryDate);

            if (now > expiry) {
                // SUBSCRIPTION EXPIRED: Revert to trial
                await StorageManager.set({
                    isPremium: false,
                    premiumType: null,
                    expiryDate: null,
                    prescriptionLimit: 2 // Default trial limit
                });
                updatePremiumUI(false);
                showCustomAlert('Subscription Expired', 'Your premium subscription has expired. Reverting to trial mode.', 'warning');
                return;
            }
        }
        updatePremiumUI(result.isPremium || false, result.premiumType);
        updateCounterDisplay();
    } catch (error) {
        console.error('Error checking premium status:', error);
    }
}

async function updateCounterDisplay() {
    try {
        const result = await StorageManager.get(['isPremium', 'prescriptionCount', 'prescriptionLimit', 'premiumType', 'expiryDate']);
        const count = result.prescriptionCount || 0;
        const limit = result.prescriptionLimit !== undefined ? result.prescriptionLimit : 2;
        const remaining = limit - count;
        const isPremium = result.isPremium || false;

        const counterDisplay = document.getElementById('counterDisplay');
        const generateBtn = document.getElementById('generateBtn');
        const saveBtn = document.getElementById('savePrescriptionBtn');
        const dashboardTitle = document.getElementById('dashboardTitle');

        // Update Dashboard Title based on status
        if (isPremium) {
            dashboardTitle.innerHTML = 'Prescription Generator <span class="pro-badge">Pro</span>';
        } else if (limit > 2) {
            dashboardTitle.textContent = 'Prescription Generator';
        } else {
            dashboardTitle.textContent = 'Prescription Generator Trial';
        }

        if (isPremium) {
            const premiumType = result.premiumType || "Premium";
            
            // Determine whether to show "Unlimited" or an Expiry Date
            let accessText = '∞ Unlimited Prescriptions ∞';
            if (result.expiryDate) {
                const date = new Date(result.expiryDate);
                const formattedDate = date.toLocaleDateString(undefined, { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });
                accessText = `Valid until: ${formattedDate}`;
            }

            counterDisplay.innerHTML = `
                <span style="color: #28a745; font-weight: bold;">⭐ ${premiumType} Account ⭐</span> <br>
                <span style="color: #28a745; font-size: 0.85em; font-weight: 400;">${accessText}</span>
            `;
            
            generateBtn.innerHTML = "Generate & Print Prescription";
            generateBtn.style.background = "#0056b3";
            generateBtn.disabled = false;
            saveBtn.style.display = 'block';
            saveBtn.disabled = false;
        } else {
            // Free Trial / Count-based logic
            if (limit === 0 || remaining <= 0) {
                counterDisplay.innerHTML = `
                    <span style="color: #dc3545; font-weight: bold;">⚠️ FREE TRIAL EXPIRED ⚠️</span>
                    <br>
                    <small style="color: #666; font-size: 0.98em;">→ upgrade to continue ←</small>
                `;
                generateBtn.innerHTML = "🔒 Upgrade to Premium";
                generateBtn.style.background = "#dc3545";
                saveBtn.style.display = 'none';
            } else {
                counterDisplay.innerHTML = `
                    Prescriptions Remaining: <span id="remainingCount" style="font-weight:bold;">${remaining}</span>
                    <br>
                    <small style="color: #666;">${count} used</small>
                `;
                generateBtn.innerHTML = "Generate & Print Prescription";
                generateBtn.style.background = "#0056b3";
                saveBtn.style.display = 'block';
            }
        }
        counterDisplay.style.display = 'block';
    } catch (error) {
        console.error('Error updating counter display:', error);
    }
}

async function incrementPrescriptionCount() {
    try {
        const result = await StorageManager.get(['prescriptionCount', 'isPremium', 'prescriptionLimit']);
        if (result.isPremium) {
            return true;
        }
        
        const currentCount = result.prescriptionCount || 0;
        const limit = result.prescriptionLimit || 2;
        const newCount = currentCount + 1;
        
        if (currentCount >= limit) {
            return false;
        }
        
        await StorageManager.set({ prescriptionCount: newCount });
        updateCounterDisplay();
        return newCount;
    } catch (error) {
        console.error('Error incrementing prescription count:', error);
        return false;
    }
}

async function checkPrescriptionLimit() {
    try {
        const result = await StorageManager.get(['isPremium', 'prescriptionCount', 'prescriptionLimit']);
        if (result.isPremium) {
            return true;
        }
        
        const count = result.prescriptionCount || 0;
        const limit = result.prescriptionLimit !== undefined ? result.prescriptionLimit : 2;
        
        if (limit === 0) {
            return false;
        }
        
        return count < limit;
    } catch (error) {
        console.error('Error checking prescription limit:', error);
        return false;
    }
}

function openPaymentModal() {
    document.getElementById('paymentModal').style.display = 'flex';
    document.getElementById('unlockSection').style.display = 'none';
    document.getElementById('showUnlockSection').style.display = 'block';
    document.getElementById('unlockCode').value = '';
    
    const unlockStatus = document.getElementById('unlockStatus');
    if (unlockStatus) {
        unlockStatus.style.display = 'none';
        unlockStatus.textContent = '';
    }
    
    const verifyBtn = document.getElementById('verifyUnlockCode');
    if (verifyBtn) {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = '✅ Verify & Unlock';
    }
}

function updatePremiumUI(isPremium, type = "Lifetime") {
    const unlockBtn = document.getElementById('showUnlockSection');
    const counterDisplay = document.getElementById('counterDisplay');
    const dashboardTitle = document.getElementById('dashboardTitle');

    if (unlockBtn) unlockBtn.style.display = isPremium ? 'none' : 'block';
    if (counterDisplay) counterDisplay.style.display = 'block';

    // Update dashboard title based on premium status
    if (isPremium) {
        dashboardTitle.innerHTML = 'Prescription Generator <span class="pro-badge">Pro</span>';
    } else {
        // Check if trial is extended
        StorageManager.get(['prescriptionLimit']).then(result => {
            const limit = result.prescriptionLimit !== undefined ? result.prescriptionLimit : 2;
            if (limit > 2) {
                dashboardTitle.textContent = 'Prescription Generator';
            } else {
                dashboardTitle.textContent = 'Prescription Generator Trial';
            }
        });
    }

    updateCounterDisplay();
}

function closePaymentModal() {
    document.getElementById('paymentModal').style.display = 'none';
}

function showUnlockSection() {
    document.getElementById('unlockSection').style.display = 'block';
    document.getElementById('showUnlockSection').style.display = 'none';
    document.getElementById('unlockCode').focus();
}
