let currentStep = 1;

// Function to update breadcrumb visuals
function updateBreadcrumbs(step) {
    currentStep = step;
    const steps = ['step1-crumb', 'step2-crumb', 'step3-crumb', 'step4-crumb'];
    
    steps.forEach((id, index) => {
        const el = document.getElementById(id);
        if (index + 1 === step) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });

    // Update Back Button Visibility
    const backBtn = document.getElementById('navBackBtn');
    backBtn.style.visibility = (step === 1) ? 'hidden' : 'visible';
}

// Logical Back Navigation
function handleBackNav() {
    if (currentStep === 4) {
        // As requested: If in Step 4 (Mailing), go all the way back to Step 1
        location.reload(); // Hard reset for session security
    } 
    else {
        window.location.href = 'home.html'; // For any other step, just go back to home
    }
}


async function verifyCredentials() {
    const user = document.getElementById("senderEmail").value;
    const pass = document.getElementById("appPassword").value;
    const verifyBtn = document.getElementById("verifyBtn");
    const uploadBtn = document.getElementById("uploadBtn");

    if (!user || !pass) {
        alert("Please enter both email and app password.");
        return;
    }

    verifyBtn.disabled = true;
    verifyBtn.textContent = "Verifying...";

    try {
        const response = await fetch("http://localhost:3000/verify-connection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user, pass }),
            credentials: 'include' // Ensure cookies are sent for session management
        });

        const result = await response.json();

        if (result.success) {
            verifyBtn.textContent = "✅ Verified";
            verifyBtn.style.backgroundColor = "#28a745";
            verifyBtn.style.color = "white";
            
            // Enable the upload button now that we know the credentials work
            uploadBtn.disabled = false;
            uploadBtn.title = "Credentials verified. You can now upload files.";
            alert("Credentials verified. You can now upload files.");

            document.getElementById('csvFile').addEventListener('change', () => {
                updateBreadcrumbs(2);
            });
        } else {
            verifyBtn.textContent = "Verify Connection";
            verifyBtn.disabled = false;
            alert(result.message);
        }
    } catch (error) {
        verifyBtn.textContent = "Verify Connection";
        verifyBtn.disabled = false;
        alert("Connection error. Is the server running?");
    }
}

const varPillsEl = document.getElementById('varPills');
const bodyEditor = document.getElementById('bodyEditor');
const subjectField = document.getElementById('subjectField');
const senderName = document.getElementById('senderName');

let currentExtractDir = null;
let zipUploaded = false;

async function uploadFile(event) {
    if (event) event.preventDefault();

    const csvInput = document.getElementById("csvFile");
    const zipInput = document.getElementById("zipFile"); // Add this ID to your HTML

    if (!csvInput.files[0]) {
        document.getElementById("uploadStatus").textContent = "CSV/Excel file is required.";
        return;
    }

    const formData = new FormData();
    if (csvInput.files[0]) formData.append("csvFile", csvInput.files[0]);
    if (zipInput.files[0]) formData.append("zipFile", zipInput.files[0]);

    try {
        const response = await fetch("http://localhost:3000/process-files", {
            method: "POST",
            body: formData,
        });

        const result = await response.json();

        if (result.success) {
            currentSheetData = result.allRows; // Store the rows
            currentExtractDir = result.extractDir;
            zipUploaded = !!document.getElementById('zipFile').files[0];
            let message = "CSV uploaded successfully!";
            if (result.files.zipFile) {
                message += " ZIP uploaded successfully!";
            }
            document.getElementById("uploadStatus").textContent = message;
            const attachmentLabel = document.getElementById('attachmentColLabel');
            if (attachmentLabel) {
                attachmentLabel.textContent = zipUploaded
                    ? 'Attachment Filename Column (Required)'
                    : 'Attachment Filename Column (Optional)';
            }

            // Execute UI updates after a tiny delay for stability
            setTimeout(() => {
                const compose = document.getElementById('composeSection');
                compose.style.display = 'block';
                
                updateBreadcrumbs(3); // Move to Step 3 in breadcrumbs

                // Smooth scroll and entrance
                compose.scrollIntoView({ behavior: 'smooth' });
                compose.classList.add('slide-up');

                // These functions need the IDs we just restored:
                initPills(result.headers); // Restores your variable buttons
                initMappingDropdowns(result.headers); // Restores your dropdowns
            }, 100);

        } else {
            document.getElementById("uploadStatus").textContent = "Failed to upload file.";
        }
    } catch (error) {
        console.error("Error:", error);
        document.getElementById("uploadStatus").textContent = "An error occurred while uploading the file.";
    }
}

//create the buttons of headers from the extracted excel or csv files
function initPills(headers){
    varPillsEl.innerHTML = '';
    headers.forEach (h => {
        const btn = document.createElement('button');
        btn.className = 'var-pill';
        btn.textContent = '{{'+h+'}}';
        btn.dataset.key = h;
        btn.onclick = () => insertVar('{{'+h+'}}',btn);
        varPillsEl.appendChild(btn);
    });
}

//insert the name of the header in the botton
function insertVar(v, btn){
    const ta = bodyEditor;
    const s = ta.selectionStart, e=ta.selectionEnd;
    ta.value = ta.value.slice(0,s)+v+ta.value.slice(e);
    ta.selectionStart = ta.selectionEnd=s+v.length;
    ta.focus();
    updatePreview();
    updateCounter();
}

//
function wrapTag(tag){
    const ta = bodyEditor;
    const s = ta.selectionStart, e=ta.selectionEnd;
    const sel = ta.value.slice(s,e) || 'text';
    const wrapped = `<${tag}>${sel}</${tag}>`;
    ta.value = ta.value.slice(0,s) + wrapped+ta.value.slice(e);
    ta.selectionStart = s; 
    ta.selectionEnd = s + wrapped.length;
    ta.focus();
    updatePreview();
}

function insertSnippet(snip){
    const ta = bodyEditor;
    const s = ta.selectionStart;
    ta.value = ta.value.slice(0,s) + snip + ta.value.slice(s);
    ta.selectionStart = ta.selectionEnd = s + snip.length;
    ta.focus();
    updatePreview();
}

function loadTemplate(){
    const t = `<p>Dear {{nickname}},</p>

<p>Congratulations on completing <b>{{event_name}}</b>!</p>

<p>Please find attached your official e-certificate for the event held on <b>{{date}}</b> at <b>{{venue}}</b>.</p>

<p>Your certificate ID is: <b>{{certificate_id}}</b></p>

<p>Best regards,<br>The Events Team</p>`;
    bodyEditor.value = t;
    subjectField.value = 'Your e-certificate for {{event_name}}';
    senderName.value = 'Events Team';
    updatePreview();
    updateCounter();
}

function highlightVars(text){
    return text.replace(/{{([\w_]+)}}/g,'<span class="preview-var">{{$1}}</span>');
}

function updatePreview() {
    const rawBody = document.getElementById('bodyEditor').value;
    const subj = document.getElementById('subjectField').value;
    const from = document.getElementById('senderName').value;
    
    //Sanitize the HTML to block <script> tags
    const cleanBody = sanitizeEmailHTML(rawBody);

    //Render the Preview
    document.getElementById('previewSubject').innerHTML = highlightVars(subj) || '(no subject)';
    document.getElementById('previewFrom').textContent = from || '(sender name)';
    
    // Use the sanitized HTML for the preview body
    document.getElementById('previewBody').innerHTML = highlightVars(cleanBody) || '(empty body)';
    
    //Update Variable Badges
    const allText = rawBody + ' ' + subj;
    const found = [...new Set([...allText.matchAll(/{{([\w_]+)}}/g)].map(m=>m[1]))];
    const usedEl = document.getElementById('usedVarsList');
    
    if(usedEl) {
        if(found.length === 0){
            usedEl.textContent = 'None yet — insert variables above.';
        } else {
            usedEl.innerHTML = found.map(v=>`<span class="mock-badge">{{${v}}}</span>`).join('');
        }
    }
}

function updateCounter(){
    document.getElementById('charCounter').textContent = bodyEditor.value.length + ' characters';
}

function switchTab(tab,btn){
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('editorPane').style.display = tab==='editor'?'block':'none';
    document.getElementById('previewPane').style.display = tab==='preview'?'block':'none';
    if(tab ==='preview') updatePreview();
}

function initMappingDropdowns(headers) {
    const emailSelect = document.getElementById('emailColSelect');
    const attachSelect = document.getElementById('attachmentColSelect');
    
    // Clear existing options
    emailSelect.innerHTML = '<option value="">-- Select Email Column --</option>';
    attachSelect.innerHTML = '<option value="">-- None (Text only) --</option>';
    
    headers.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h;
        opt.textContent = h;
        
        emailSelect.appendChild(opt.cloneNode(true));
        attachSelect.appendChild(opt);
    });
    
    // Show the card
    //document.getElementById('mappingCard').style.display = 'block';
    document.getElementById('composeSection').style.display = 'block';
}

function sanitizeEmailHTML(rawHTML) {
    //Create a virtual document to parse the string
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHTML, 'text/html');

    //Find and remove all <script> tags
    const scripts = doc.querySelectorAll('script');
    scripts.forEach(s => s.remove());

    //Find and remove all 'on' event attributes (e.g., onclick, onerror)
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
        const attrs = el.attributes;
        for (let i = attrs.length - 1; i >= 0; i--) {
            if (attrs[i].name.startsWith('on')) {
                el.removeAttribute(attrs[i].name);
            }
        }
        
        // Block javascript: links in <a> tags
        if (el.tagName === 'A' && el.getAttribute('href')?.startsWith('javascript:')) {
            el.removeAttribute('href');
        }
    });

    // Return the cleaned body content
    return doc.body.innerHTML;
}

// Variable to store the headers/data from the upload step
let currentSheetData = []; 
let failedRecords = []; // To track failed email attempts for retrying later
let isPaused = false; // To track if the batch process is currently paused
let shouldStopSending = false;

const checkPause = () => {
    return new Promise(resolve => {
        const interval = setInterval(() => {
            if (!isPaused) {
                clearInterval(interval);
                resolve();
            }
        }, 500);
    });
}

function togglePause() {
    const icon = document.getElementById("pausePlayIcon");
    const btn = document.getElementById("pausePlayBtn");
    
    isPaused = !isPaused;
    
    if (isPaused) {
        icon.className = "bi bi-play-fill fs-4";
        btn.classList.replace("btn-outline-primary", "btn-primary");
    } else {
        icon.className = "bi bi-pause-fill fs-4";
        btn.classList.replace("btn-primary", "btn-outline-primary");
        // Trigger the counter update back to "Processing..."
    }
}

function stopSending() {
    if (confirm("Stop all remaining emails?")) {
        shouldStopSending = true;
        isPaused = false; // Ensure it's not stuck in a pause state
    }
}

// function stopSending() {
//     if (confirm("Are you sure you want to stop the sending process? You can resume later, and any failed records will be available for download.")) {
//         shouldStopSending = true;
//     }
// }

function scrollToInput(element) {
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof element.focus === 'function') {
        element.focus({ preventScroll: true });
    }
}

function switchToDashboard() {
    const emailColSelect = document.getElementById('emailColSelect');
    if (!emailColSelect || !emailColSelect.value) {
        alert('Please map the Recipient Email Column.');
        scrollToInput(emailColSelect);
        return;
    }

    const subjectField = document.getElementById('subjectField');
    if (!subjectField || !subjectField.value || subjectField.value.trim() === '') {
        alert('Please enter an email subject.');
        scrollToInput(subjectField);
        return;
    }

    const senderName = document.getElementById('senderName');
    if (!senderName || !senderName.value || senderName.value.trim() === '') {
        alert('Please enter a sender name.');
        scrollToInput(senderName);
        return;
    }

    const attachmentColSelect = document.getElementById('attachmentColSelect');
    if (zipUploaded && (!attachmentColSelect || !attachmentColSelect.value)) {
        alert('Please select the Attachment Filename Column.');
        scrollToInput(attachmentColSelect);
        return;
    }

    const bodyEditor = document.getElementById('bodyEditor');
    if (!bodyEditor || !bodyEditor.value || bodyEditor.value.trim() === '') {
        alert('Please enter an email body.');
        scrollToInput(bodyEditor);
        return;
    }

    // 1. Hide Config View
    const configView = document.getElementById('configView');
    if (configView) {
        configView.classList.remove('view-active');
        configView.style.display = 'none';
    }
    const dashboardView = document.getElementById('dashboardView');
    if (dashboardView) {
        dashboardView.classList.add('view-active');
        dashboardView.style.display = 'block';
    }
    updateBreadcrumbs(4);

    // 2. Show Dashboard View
    if (dashboardView) {
        dashboardView.classList.add('view-active');
        dashboardView.style.display = 'block';
    }

    // 3. Immediately trigger the bulk send
    sendBulkEmails();
}


// async function sendBulkEmails(event) {
//     if (event) event.preventDefault();
//     failedRecords = []; // Reset failed records at the start of each send attempt
    
//     const emailCol = document.getElementById('emailColSelect').value;
//     const progressBody = document.getElementById('progressBody');

//     const BATCH_SIZE = 20; // Set your batch size here
//     const LONG_DELAY = 60000; // 60 seconds in milliseconds
//     const SHORT_DELAY = 2000; // 2 seconds between emails

//     Show the progress card and clear previous results
//     const total = currentSheetData.length;
//     const counterEl = document.getElementById('overallCounter');
//     document.getElementById('progressCard').style.display = 'block';
//     progressBody.innerHTML = ''; 
    

//     Loop through each row of the current sheet data
//     for (let i = 0; i < currentSheetData.length; i++) {
//         const row = currentSheetData[i];
//         const email = row[emailCol];
//         const rawBody = document.getElementById('bodyEditor').value;

//         if(shouldStopSending) {
//             counterEl.textContent = `Process stopped by user. ${i} of ${total} emails processed.`;
//             counterEl.style.color = "Red";
//             break;
//         }

//         if (isPaused) {
//             counterEl.textContent = `Paused... ${i} of ${total} emails processed.`;
//             await checkPause();
//         }

//         document.getElementById("currentRecipientDisplay").textContent = `Current Recipient: ${email || '(no email found in this row)'}`;

//         let previewBody = rawBody;
//         Replace variables in the preview body with actual values from the row
//         Object.keys(row).forEach(key => {
//             const regex = new RegExp(`{{${key}}}`, 'g');
//             previewBody = previewBody.replace(regex, row[key]);
//         });

//         document.getElementById("liveBodyContent").innerHTML = sanitizeEmailHTML(previewBody);
        
//         1. UI: Create row and set to "Sending..."
//         const tr = document.createElement('tr');
//         tr.innerHTML = `
//             <td style="padding: 8px; border-bottom: 1px solid #eee;">${email}</td>
//             <td class="status-cell" style="padding: 8px; border-bottom: 1px solid #eee; color: orange;">Sending...</td>
//         `;
//         progressBody.appendChild(tr);
//         const statusCell = tr.querySelector('.status-cell');

//         2. Prepare Payload
//         const payload = {
//             auth: {
//                 user: document.getElementById("senderEmail").value,
//                 pass: document.getElementById("appPassword").value
//             },
//             recipients: allRowsFromCSV,
//             subject: document.getElementById("subjectField").value,
//             body: document.getElementById("bodyEditor").value,
//             senderName: document.getElementById("senderName").value,
//             rowData: row,
//             extractDir: currentExtractDir,
//             attachmentFileName: row[document.getElementById('attachmentColSelect').value]
//         };

//         3. Send Email
//         try {
//             const response = await fetch("http://localhost:3000/api/send-bulk", {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify(payload)
//             });
//             const result = await response.json();

//             if(result.success) {
//                 statusCell.textContent = "✅ Success";
//                 statusCell.style.color = "green";
//             } else {
//                 statusCell.textContent = "❌ Failed";
//                 statusCell.style.color = "red";
//                 failedRecords.push({ ...row, Error_Reason: result.message || 'SMTP Reject' });
//                 document.getElementById('downloadFailedBtn').style.display = 'inline-block';
//             }
//         } catch (err) {
//             statusCell.textContent = "⚠️ Error";
//             failedRecords.push({ row, Error_Reason: err.message || 'Network/Server Error' });
//             document.getElementById('downloadFailedBtn').style.display = 'inline-block';
//         }

        

//         4. BATCH LOGIC
//         const count = i + 1; // Current number of emails processed
//         const isLastEmail = count === currentSheetData.length;

//         counterEl.textContent = `Processing: ${count} of ${total} emails sent...`;
//         5. Update Counter, show the break message if needed, and continue to next email
//         if (count % BATCH_SIZE === 0 && !isLastEmail) {
//             1. Create a special "Pause Row"
//             const pauseMsg = document.createElement('tr');
//             pauseMsg.id = "pauseRow"; // ID so we can find and remove it later
//             progressBody.appendChild(pauseMsg);

//             2. Countdown logic for the pause
//             let pauseCounter = 60;
//             while (pauseCounter > 0) {
//                 pauseMsg.innerHTML = 
//                 `<td colspan="2" style="padding: 8px; border-bottom: 1px solid #eee; color: blue; text-align: center;">
//                     Pausing for batch cooldown... Resuming in ${pauseCounter} seconds.
//                 </td>`;
//                 await new Promise(resolve => setTimeout(resolve, 1000));
//                 pauseCounter--;
//             }

//             3. Remove the message and continue
//             pauseMsg.remove();
//         }
//         else if (!isLastEmail) {
//             Short delay between emails to avoid overwhelming the server
//             await new Promise(resolve => setTimeout(resolve, SHORT_DELAY));
//         }
//     }
//     counterEl.textContent = `Completed: All ${total} emails processed.`;
//     counterEl.style.color = "green";

//     document.getElementById("finishSection").style.display = "block";

//     if (failedRecords.length > 0) {
//         document.getElementById('downloadFailedBtn').style.display = 'inline-block';
//     } else {
//         document.getElementById('downloadFailedBtn').style.display = 'none';
//     }

//     alert("Bulk sending process completed!");
// }
// async function sendBulkEmails() {
//     const allRows = Array.from(document.querySelectorAll('#csvTable tbody tr'));
//     const recipientsData = [];

//     // 1. Collect all data into an array
//     allRows.forEach(row => {
//         const rowData = {}; // Map your CSV columns here
//         // ... (Logic to pull data from your table cells into rowData)
        
//         recipientsData.push({
//             email: row.querySelector('.email-cell').textContent,
//             rowData: rowData,
//             attachmentFileName: row.dataset.attachmentName // or however you store it
//         });
//     });

//     // 2. Prepare the single Payload
//     const payload = {
//         auth: {
//             user: document.getElementById("senderEmail").value,
//             pass: document.getElementById("appPassword").value
//         },
//         recipients: recipientsData, // The entire array
//         subject: document.getElementById("subjectField").value,
//         body: document.getElementById("bodyEditor").value,
//         senderName: document.getElementById("senderName").value,
//         extractDir: currentExtractDir
//     };

//     // 3. Send ONCE to the server
//     try {
//         const response = await fetch("/api/send-bulk", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify(payload)
//         });
//         const result = await response.json();
        
//         if(result.success) {
//             alert(`Success! Batch #${result.batchId} created.`);
//             window.location.href = "/history"; // Move to dashboard to see results
//         }
//     } catch (err) {
//         console.error("Bulk Send Error:", err);
//     }
// }

async function sendBulkEmails() {
    const tableRows = document.querySelectorAll('#progressBody tr');
    const recipientsData = [];

    console.log("Total rows found:", tableRows.length);

    tableRows.forEach((row) => {
        // 1. Try to find the email. 
        // If your email is in the SECOND column, use row.cells[1]
        // If it's in the FIRST column, use row.cells[0]
        const emailCell = row.cells[0]; 
        
        if (emailCell) {
            const email = emailCell.textContent.trim();

            if (email.includes('@')) {
                recipientsData.push({
                    email: email,
                    rowData: rowData,
                    attachmentFileName: row.getAttribute('data-attachment') || ""
                });
            }
        }
    });

    console.log("Recipients Data built:", recipientsData);

    if (recipientsData.length === 0) {
        alert("No valid recipients found! Check if the email is in the second column of your table.");
        return;
    }

    // 2. Switch UI to Live Dashboard Mode
    // Hide the setup/preview container and show the progress container
    document.getElementById('setup-container').classList.add('d-none');
    document.getElementById('live-dashboard').classList.remove('d-none');
    
    // Reset progress markers
    const progressBar = document.getElementById('main-progress-bar');
    const statusText = document.getElementById('status-text');
    progressBar.style.width = "0%";
    statusText.innerText = "Initializing batch...";

    // 3. Prepare Payload
    const payload = {
        auth: {
            user: document.getElementById("senderEmail").value,
            pass: document.getElementById("appPassword").value
        },
        recipients: recipientsData, // Array for backend .length
        subject: document.getElementById("subjectField").value,
        body: document.getElementById("bodyEditor").value,
        senderName: document.getElementById("senderName").value,
        extractDir: currentExtractDir // Defined globally in your script
    };

    // 4. Send to Server
    try {
        statusText.innerText = `Sending to ${recipientsData.length} recipients...`;
        
        const response = await fetch("/api/send-bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
            // Update Dashboard to "Finished" state
            progressBar.style.width = "100%";
            progressBar.classList.replace('bg-info', 'bg-success');
            statusText.innerHTML = `✅ Successfully processed Batch #${result.batchId}.`;
            
            // Show a button to go to history instead of auto-redirecting
            const historyBtn = document.getElementById('go-to-history-btn');
            if(historyBtn) historyBtn.classList.remove('d-none');

        } else {
            statusText.innerText = "❌ Error: " + result.message;
            progressBar.classList.replace('bg-info', 'bg-danger');
        }

    } catch (err) {
        console.error("Fetch Error:", err);
        statusText.innerText = "⚠️ Server connection failed.";
    }
}

function downloadFailedCSV() {
    if (failedRecords.length === 0) {
        alert("No failed records to download. All emails were sent successfully!");
        return;
    }

    // Get headers from the first failed record (assuming all have the same structure)
    const headers = Object.keys(failedRecords[0]);  

    // Create CSV content
    const csvRows = [
        headers.join(','), // Header row
        ...failedRecords.map(record => 
            headers.map(header => {
                let value = record[header] === null || record[header] === undefined ? "" : String(record[header]);
                return `"${value.replace(/"/g, '""')}"`; // Wraps values in quotes to handle commas within cells
            }).join(',')
        )
    ].join('\n');

    // Create a Blob and trigger download
    const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `failed_emails_1_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// to clear the session and delete all uploaded files from the server cache
async function finishSession() {
    if (!confirm("Are you sure? This will delete all uploaded files and clear your session data.")) return;

    try {
        await fetch("http://localhost:3000/cleanup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ extractDir: currentExtractDir })
        });

        // Clear all sensitive global variables
        currentSheetData = [];
        currentExtractDir = null;
        document.getElementById("senderEmail").value = "";
        document.getElementById("appPassword").value = "";
        document.getElementById("csvFile").value = "";
        document.getElementById("zipFile").value = "";
        
        // Reset UI
        document.getElementById("composeSection").style.display = "none";
        document.getElementById("mappingCard").style.display = "none";
        document.getElementById("uploadStatus").textContent = "Session cleared. Files deleted.";

        window.location.href = "home.html";
        
        alert("Cleanup complete. All data has been wiped from the server cache.");
    } catch (error) {
        console.error("Cleanup failed:", error);
        window.location.href = "home.html";
    }
}

// Flip card logic - only one card can be flipped at a time
let currentFlippedCard = null;

function toggleFlipCard(card) {
    const flipCardDiv = card.closest('.flip-card');
    
    // If clicking the same card, just toggle it
    if (currentFlippedCard === flipCardDiv) {
        flipCardDiv.classList.toggle('flipped');
        if (!flipCardDiv.classList.contains('flipped')) {
            currentFlippedCard = null;
        }
        return;
    }
    
    // Unflip the previously flipped card
    if (currentFlippedCard) {
        currentFlippedCard.classList.remove('flipped');
    }
    
    // Flip the new card
    flipCardDiv.classList.add('flipped');
    currentFlippedCard = flipCardDiv;
}

const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const container = document.getElementById('authContainer');

signUpButton.addEventListener('click', () => {
    container.classList.add("right-panel-active");
});

signInButton.addEventListener('click', () => {
    container.classList.remove("right-panel-active");
});

// Attach form event listeners
const signupForm = document.getElementById('signupForm');
const loginForm = document.getElementById('loginForm');

signupForm?.addEventListener('submit', (event) => handleAuth(event, 'signup'));
loginForm?.addEventListener('submit', (event) => handleAuth(event, 'login'));

document.getElementById('signupPasswordToggle')?.addEventListener('click', () => togglePasswordVisibility('signupPassword', 'signupPasswordToggle'));
document.getElementById('loginPasswordToggle')?.addEventListener('click', () => togglePasswordVisibility('loginPassword', 'loginPasswordToggle'));

function togglePasswordVisibility(inputId, buttonId) {
    const input = document.getElementById(inputId);
    const button = document.getElementById(buttonId);
    const icon = button?.querySelector('i');
    if (!input || !button || !icon) return;

    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('bi-eye-fill', 'bi-eye-slash-fill');
    } else {
        input.type = 'password';
        icon.classList.replace('bi-eye-slash-fill', 'bi-eye-fill');
    }
}

async function handleAuth(event, type) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    document.querySelectorAll('.error-message').forEach(el => el.remove());

    try {
        const response = await fetch(type === 'signup' ? '/register' : '/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const text = await response.text();
        let result;
        try {
            result = JSON.parse(text);
        } catch (parseError) {
            console.error('Failed to parse auth response:', text, parseError);
            alert('Unexpected server response. Please refresh and try again.');
            return;
        }

        if (!result.success) {
            const targetInput = form.querySelector(`input[name="${result.field}"]`);
            if (targetInput) {
                targetInput.classList.add('input-error');

                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i> ${result.message}`;
                targetInput.insertAdjacentElement('afterend', errorDiv);
            }
        }
        else {
            window.location.href = 'home.html';
        }
    } catch (error) {
        console.error('Error in handleAuth:', error);
        alert('An error occurred. Please try again.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Activate signup mode when the auth page is opened with #signup
    if (window.location.hash === '#signup') {
        container.classList.add('right-panel-active');
    } else if (window.location.hash === '#login') {
        container.classList.remove('right-panel-active');
    }
});

document.addEventListener('DOMContentLoaded', loadBatches);

async function loadBatches() {
    try {
        const response = await fetch('/api/batches');
        const batches = await response.json();
        const list = document.getElementById('batchList');
    
        if (batches.length === 0) {
            list.innerHTML = '<div class="p-4 text-center text-muted">No history found.</div>';
            return;
        }

        list.innerHTML = batches.map(batch => `
            <div class="list-group-item batch-item p-3" onclick="loadDetails(${batch.BatchID}, this)">
                <div class="d-flex justify-content-between align-items-center">
                    <h6 class="mb-1 fw-bold text-truncate" style="max-width: 150px;">${batch.Subject || 'No Subject'}</h6>
                    <small class="text-muted" style="font-size: 0.7rem;">${new Date(batch.SentDate).toLocaleDateString()}</small>
                </div>
                <div class="d-flex justify-content-between small mt-2">
                    <span>ID: #${batch.BatchID}</span>
                    <span class="fw-bold">${batch.SuccessCount}/${batch.TotalRecipients} Sent</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading batches:', error);
        document.getElementById('batchList').innerHTML = '<div class="p-4 text-center text-danger">Failed to load history.</div>';
    }
}

async function loadDetails(batchId, element) {
    // 1. UI Highlight Toggle
    document.querySelectorAll('.batch-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');

    // 2. Show the Detail Container, Hide Placeholder
    document.getElementById('details-placeholder').classList.add('d-none');
    const detailsContent = document.getElementById('details-content');
    detailsContent.classList.remove('d-none');

    // 3. Fetch Data
    const response = await fetch(`/api/batch-details/${batchId}`);
    const logs = await response.json();

    // 4. Map Data to the UI
    const batchData = {
        subject: element.querySelector('h6').innerText,
        date: element.querySelector('small').innerText,
        total: logs.length,
        success: logs.filter(l => l.Status === 'Success').length
    };

    const percent = batchData.total > 0 ? Math.round((batchData.success / batchData.total) * 100) : 0;

    // Update Header and Progress
    document.getElementById('detail-subject').innerText = batchData.subject;
    document.getElementById('detail-date').innerText = batchData.date;
    document.getElementById('detail-percent').innerText = `${percent}%`;
    document.getElementById('detail-progress-bar').style.width = `${percent}%`;

    // Map logs to Table Rows
    const logsBody = document.getElementById('logs-body');
    logsBody.innerHTML = logs.map(log => `
        <tr>
            <td class="small fw-bold">${log.RecipientEmail}</td>
            <td>
                <span class="badge ${log.Status === 'Success' ? 'status-badge-success' : 'status-badge-failed'} rounded-pill">
                    ${log.Status}
                </span>
            </td>
            <td class="text-muted small">${log.ErrorMessage || 'Delivered successfully'}</td>
        </tr>
    `).join('');
}