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
        const response = await fetch(`${GOOGLE_SHEETS_WEB_APP_URL}?code=${encodeURIComponent(code)}`);
        const result = await response.json();
        
        if (result.success) {
            // Get current subscription details
            const currentResult = await StorageManager.get([
                'isPremium', 
                'premiumType', 
                'expiryDate', 
                'prescriptionCount',
                'usedCodes'
            ]);
            
            // CASE 1: LIFETIME CODES
            if (result.type === "Lifetime") {
                await StorageManager.set({
                    isPremium: true,
                    premiumType: "Lifetime",
                    expiryDate: null,
                    prescriptionLimit: null, // null means unlimited for premium users
                    prescriptionCount: currentResult.prescriptionCount || 0,
                    usedCodes: [...(currentResult.usedCodes || []), code],
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

                // Calculate new expiry date
                const now = new Date();
                let newExpiry = new Date(now);
                
                // If user already has a premium subscription with future expiry
                if (currentResult.expiryDate && currentResult.isPremium) {
                    const currentExpiry = new Date(currentResult.expiryDate);
                    
                    // If current expiry is in the future, extend from current expiry date
                    if (currentExpiry > now) {
                        newExpiry = new Date(currentExpiry);
                        newExpiry.setMonth(newExpiry.getMonth() + monthsToAdd);
                    } else {
                        // Current subscription expired, start from today
                        newExpiry.setMonth(now.getMonth() + monthsToAdd);
                    }
                } else {
                    // New subscription or no current premium, start from today
                    newExpiry.setMonth(now.getMonth() + monthsToAdd);
                }

                await StorageManager.set({
                    isPremium: true,
                    premiumType: result.type,
                    expiryDate: newExpiry.toISOString(),
                    prescriptionLimit: null, // null means unlimited for premium users
                    prescriptionCount: currentResult.prescriptionCount || 0,
                    usedCodes: [...(currentResult.usedCodes || []), code],
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
                    showSuccessMessage('Subscription Updated', `${result.type} subscription activated successfully!`);
                }, 500);
            } 
            // CASE 3: COUNT-BASED CODES (Trial extensions)
            else if (result.type.includes("Trial") || !isNaN(parseInt(result.type))) {
                const match = result.type.match(/\d+/);
                const additionalPrescriptions = match ? parseInt(match[0]) : 10;
                
                const newLimit = (currentResult.prescriptionLimit || 2) + additionalPrescriptions;
                
                await StorageManager.set({
                    isPremium: false,
                    prescriptionCount: currentResult.prescriptionCount || 0,
                    prescriptionLimit: newLimit,
                    usedCodes: [...(currentResult.usedCodes || []), code],
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
                    prescriptionCount: currentResult.prescriptionCount || 0,
                    prescriptionLimit: null, // null means unlimited for premium users
                    usedCodes: [...(currentResult.usedCodes || []), code],
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
        const result = await StorageManager.get(['isPremium', 'expiryDate', 'prescriptionLimit', 'premiumType', 'prescriptionCount']);
        
        console.log('checkPremiumStatus - Current state:', result);
        
        // Ensure premium users have null prescriptionLimit (unlimited)
        if (result.isPremium && result.prescriptionLimit !== null) {
            console.log('Fixing: Premium user should have null prescriptionLimit');
            await StorageManager.set({
                prescriptionLimit: null
            });
        }
        
        // Check for expired subscriptions (only if they have an expiry date)
        if (result.isPremium && result.expiryDate) {
            const now = new Date();
            const expiry = new Date(result.expiryDate);

            if (now > expiry) {
                // SUBSCRIPTION EXPIRED: Revert to trial
                console.log('Premium subscription expired, reverting to trial');
                await StorageManager.set({
                    isPremium: false,
                    premiumType: null,
                    expiryDate: null,
                    prescriptionLimit: 2, // Default trial limit
                    prescriptionCount: 0  // Reset count
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
        const limit = (result.prescriptionLimit !== null && result.prescriptionLimit !== undefined) ? result.prescriptionLimit : 2;
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

        console.log('Counter display - Premium:', isPremium, 'Limit:', limit, 'Count:', count, 'Remaining:', remaining);

        if (isPremium) {
            const premiumType = result.premiumType || "Premium";
            
            // Determine whether to show "Unlimited" or an Expiry Date
            let accessText = '∞ Unlimited Prescriptions ∞';
            let daysLeftText = '';
            let daysLeft = 0;
            
            if (result.expiryDate) {
                const expiryDate = new Date(result.expiryDate);
                const now = new Date();
                
                // Calculate days left
                const timeDiff = expiryDate - now;
                daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
                
                // Format date for display
                const formattedDate = expiryDate.toLocaleDateString(undefined, { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });
                
                // Determine color based on days left
                let daysLeftColor = '#28a745'; // Default green
                if (daysLeft <= 7) {
                    daysLeftColor = '#ffc107'; // Yellow for warning (7 days or less)
                }
                if (daysLeft <= 3) {
                    daysLeftColor = '#dc3545'; // Red for critical (3 days or less)
                }
                
                accessText = `Valid Until: ${formattedDate}`;
                daysLeftText = ` | Days Left: <span style="color: ${daysLeftColor}; font-weight: bold;">${daysLeft} days</span>`;
            }

            counterDisplay.innerHTML = `
                <span style="color: #28a745; font-weight: bold;">⭐ ${premiumType} Subscription ⭐</span> <br>
                <span style="color: #28a745; font-size: 0.85em; font-weight: 400;">${accessText}</span>
                <span style="font-size: 0.85em; font-weight: 400;">${daysLeftText}</span>
            `;
            
            generateBtn.innerHTML = "Generate & Print Prescription";
            generateBtn.style.background = "#0056b3";
            generateBtn.disabled = false;
            generateBtn.style.cursor = "pointer";
            saveBtn.style.display = 'block';
            saveBtn.disabled = false;
            saveBtn.style.cursor = "pointer";
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
                generateBtn.style.cursor = "pointer";
                saveBtn.style.display = 'none';
            } else {
                // Determine color based on remaining prescriptions
                let remainingColor = '#28a745'; // Default green
                if (remaining <= 5) {
                    remainingColor = '#ffc107'; // Yellow for warning (5 or less)
                }
                if (remaining <= 2) {
                    remainingColor = '#dc3545'; // Red for critical (2 or less)
                }
                
                counterDisplay.innerHTML = `
                    Prescriptions Remaining: <span id="remainingCount" style="font-weight:bold; color: ${remainingColor};">${remaining}</span>
                    <br>
                    <small style="color: #666;">${count} used of ${limit} total</small>
                `;
                generateBtn.innerHTML = "Generate & Print Prescription";
                generateBtn.style.background = "#0056b3";
                generateBtn.disabled = false;
                generateBtn.style.cursor = "pointer";
                saveBtn.style.display = 'block';
                saveBtn.disabled = false;
                saveBtn.style.cursor = "pointer";
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
            return true; // Premium users have unlimited
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
            return true; // Premium users always have access
        }
        
        const count = result.prescriptionCount || 0;
        const limit = (result.prescriptionLimit !== null && result.prescriptionLimit !== undefined) ? result.prescriptionLimit : 2;
        
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
    
    // Update the trial expired alert to show generic upgrade message
    const trialAlert = document.querySelector('#paymentModal [style*="Free Trial Expired"]');
    if (trialAlert) {
        trialAlert.innerHTML = `
            <strong style="color:#0056b3;font-size:16px;">💎 Upgrade Your Plan</strong><br>
            <span style="color:#555;">Choose a plan that fits your needs. You can upgrade at any time!</span>
        `;
        trialAlert.style.background = "#eef4ff";
        trialAlert.style.border = "2px dashed #0056b3";
    }
    
    // Update the modal to show correct status
    checkPremiumStatus();
}

function updatePremiumUI(isPremium, type = "Lifetime") {
    const unlockBtn = document.getElementById('showUnlockSection');
    const counterDisplay = document.getElementById('counterDisplay');
    const dashboardTitle = document.getElementById('dashboardTitle');

    if (unlockBtn) unlockBtn.style.display = 'block'; // Always show unlock button
    if (counterDisplay) counterDisplay.style.display = 'block';

    // Update dashboard title based on premium status
    if (isPremium) {
        dashboardTitle.innerHTML = 'Prescription Generator <span class="pro-badge">Pro</span>';
    } else {
        // Check if trial is extended
        StorageManager.get(['prescriptionLimit']).then(result => {
            const limit = (result.prescriptionLimit !== null && result.prescriptionLimit !== undefined) ? result.prescriptionLimit : 2;
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

// Helper function to calculate days left
function calculateDaysLeft(expiryDate) {
    if (!expiryDate) return null;
    
    const now = new Date();
    const expiry = new Date(expiryDate);
    const timeDiff = expiry - now;
    
    if (timeDiff <= 0) return 0;
    
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
}

// Helper function to get days left color
function getDaysLeftColor(daysLeft) {
    if (daysLeft <= 3) return '#dc3545'; // Red for critical (3 days or less)
    if (daysLeft <= 7) return '#ffc107'; // Yellow for warning (7 days or less)
    return '#28a745'; // Green for normal
}

// Helper function to format expiry date with days left
function formatExpiryInfo(expiryDate) {
    if (!expiryDate) return { dateText: '∞ Unlimited', daysLeft: null };
    
    const expiry = new Date(expiryDate);
    const daysLeft = calculateDaysLeft(expiryDate);
    
    const formattedDate = expiry.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
    
    return {
        dateText: formattedDate,
        daysLeft: daysLeft,
        color: getDaysLeftColor(daysLeft)
    };
}

// Helper function to reset trial for debugging
async function resetTrialForTesting() {
    if (confirm("Reset to initial trial state (2 free prescriptions)?")) {
        await StorageManager.set({
            prescriptionLimit: 2,
            prescriptionCount: 0,
            isPremium: false,
            premiumType: null,
            expiryDate: null,
            usedCodes: []
        });
        await checkPremiumStatus();
        await updateCounterDisplay();
        showSuccessMessage('Trial Reset', 'Reset to initial trial state with 2 free prescriptions.');
    }
}
