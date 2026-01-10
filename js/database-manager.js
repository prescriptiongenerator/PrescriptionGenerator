// database-manager.js - Medicine database functions (Web Compatible)

// ====== MEDICINE DATABASE FUNCTIONS ======
async function initMedicineDatabase() {
    try {
        medicineDatabase = await loadMedicineDatabase();
        updateDatabaseUI();
    } catch (error) {
        console.error('Failed to load medicine database:', error);
        showCustomAlert('Database Error', 'Failed to load medicine database.', 'error');
    }
}

function loadMedicineDatabase() {
    return new Promise(async (resolve) => {
        try {
            const result = await StorageManager.get(['medicineDatabase']);
            resolve(result.medicineDatabase || []);
        } catch (error) {
            console.error('Error loading medicine database:', error);
            resolve([]);
        }
    });
}

async function handleMedicineDatabaseUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const medicines = await parseMedicineFile(file);
        await saveMedicineDatabase(medicines);
        medicineDatabase = medicines;
        
        updateDatabaseUI();
        showSuccessMessage('Database Updated', `Successfully loaded ${medicines.length} medicines.`);
    } catch (error) {
        console.error('Upload failed:', error);
        showCustomAlert('Upload Failed', error.message, 'error');
    }
}

function parseMedicineFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                let medicines = [];
                
                if (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt')) {
                    medicines = parseCSV(e.target.result);
                } else if (file.name.toLowerCase().endsWith('.json')) {
                    const data = JSON.parse(e.target.result);
                    medicines = data.medicines || [];
                } else {
                    reject(new Error('Unsupported file format. Use CSV or JSON.'));
                    return;
                }
                
                resolve(medicines);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// Parse CSV content with NEW format
function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const medicines = [];
    
    // Skip header if exists
    const startIndex = lines[0].toLowerCase().includes('name') ? 1 : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
        // Handle quoted values and commas inside values
        const values = parseCSVLine(lines[i]);
        
        const medicine = {
            name: values[0]?.trim() || '',
            quantity: values[1]?.trim() || '',
            unit: values[2]?.trim() || '',
            dose: values[3]?.trim() || '',
            frequency: values[4]?.trim() || '',
            days: values[5]?.trim() || '',
            meal: values[6]?.trim() || '',
            note: values[7]?.trim() || ''
        };
        
        if (medicine.name) {
            medicines.push(medicine);
        }
    }
    
    return medicines;
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    values.push(current);
    return values;
}

function saveMedicineDatabase(medicines) {
    return new Promise(async (resolve) => {
        try {
            await StorageManager.set({ medicineDatabase: medicines });
            resolve();
        } catch (error) {
            console.error('Error saving medicine database:', error);
            showCustomAlert('Save Error', 'Failed to save medicine database.', 'error');
            resolve();
        }
    });
}

function updateDatabaseUI() {
    const statusElement = document.getElementById('dbStatus');
    const countElement = document.getElementById('dbCount');
    const previewElement = document.getElementById('medicinePreview');
    
    if (medicineDatabase && medicineDatabase.length > 0) {
        statusElement.textContent = 'Loaded';
        statusElement.style.color = '#28a745';
        countElement.textContent = medicineDatabase.length;
        
        // Update preview
        const previewHTML = medicineDatabase.slice(0, 10).map(med => 
            `<div style="padding: 5px; border-bottom: 1px solid #eee;">
                <strong>${med.name}</strong>
                <div style="color: #666; font-size: 10px;">
                    ${med.quantity || ''} ${med.unit || ''} • ${med.dose || 'N/A'} • ${med.frequency || 'N/A'}
                </div>
            </div>`
        ).join('');
        
        previewElement.innerHTML = previewHTML || '<div>No medicines found</div>';
    } else {
        statusElement.textContent = 'Not Loaded';
        statusElement.style.color = '#dc3545';
        countElement.textContent = '0';
        previewElement.innerHTML = '<div>No medicine database loaded.</div>';
    }
}

function downloadSampleCSV() {
    const sampleData = `name,quantity,unit,dose,frequency,days,meal,note
Paracetamol,10,tab,1+0+1,Daily,3,After Meal,Take after meal
Amoxicillin,6,cap,1+0+1,7 days,7,After Meal,Complete full course
Cetirizine,10,tab,0+0+1,Daily,5,After Meal,May cause drowsiness
Omeprazole,14,cap,1+0+0,Daily,14,Before Meal,Before breakfast
Metformin,20,tab,0+1+0,Daily,30,With Meal,Take with food
Aspirin,10,tab,0+0+1,Daily,10,After Meal,After meals
Atorvastatin,30,tab,0+0+1,Daily,30,Before Meal,At night
Losartan,30,tab,1+0+0,Daily,30,Before Meal,Morning only`;

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medicine_database_sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportMedicineDatabase() {
    if (!medicineDatabase || medicineDatabase.length === 0) {
        showCustomAlert('No Data', 'Medicine database is empty.', 'info');
        return;
    }
    
    const data = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        count: medicineDatabase.length,
        medicines: medicineDatabase
    };
    
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medicine_database_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showSuccessMessage('Database Exported', `Exported ${medicineDatabase.length} medicines.`);
}

function clearMedicineDatabase() {
    showCustomAlert('Clear Database', 'Are you sure you want to clear all medicine data?', 'warning').then(async (confirmed) => {
        if (confirmed) {
            medicineDatabase = [];
            try {
                await StorageManager.set({ medicineDatabase: [] });
                updateDatabaseUI();
                showSuccessMessage('Database Cleared', 'All medicine data has been removed.');
            } catch (error) {
                console.error('Error clearing database:', error);
                showCustomAlert('Error', 'Failed to clear medicine database.', 'error');
            }
        }
    });
}