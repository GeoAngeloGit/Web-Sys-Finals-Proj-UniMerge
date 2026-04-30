/*async function sendTest() {
    // get the input values from the form
    const data = {
        senderEmail : document.getElementById("senderEmail").value,
        appPassword : document.getElementById("appPassword").value,
        recipientEmail : document.getElementById("recipientEmail").value,
        subject : document.getElementById("subject").value,
        message : document.getElementById("message").value
    }
    
    const statusDiv = document.getElementById("status");
    statusDiv.textContent = "Sending email...";

    try {
        // send the data to the Node.js server
        const response = await fetch("http://localhost:3000/notify", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        //update the UI based on the response
        if (result.success) {
            statusDiv.style.color = "green";
            statusDiv.textContent = "Email sent successfully!";
        } else {
            statusDiv.style.color = "red";
            statusDiv.textContent = "Failed to send email.";
        }
    } catch (error) {
        console.error("Error:", error);
        statusDiv.style.color = "red";
        statusDiv.textContent = "An error occurred while sending the email.";
    }
    
}*/

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
            body: JSON.stringify({ user, pass })
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

async function uploadFile(event) {
    if (event) event.preventDefault();

    const csvInput = document.getElementById("csvFile");
    const zipInput = document.getElementById("zipFile"); // Add this ID to your HTML

    if (!csvInput.files[0]) {
        document.getElementById("uploadStatus").textContent = "CSV file is required.";
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
            let message = "CSV uploaded successfully!";
            if (result.files.zipFile) {
                message += " ZIP uploaded successfully!";
            }
            document.getElementById("uploadStatus").textContent = message;

            // Execute UI updates after a tiny delay for stability
            setTimeout(() => {
                // initPills(result.headers);
                // initMappingDropdowns(result.headers);
                
                // // Show the sections
                // const composeSection = document.getElementById("composeSection");
                // if (composeSection) composeSection.style.display = "block";
                // composeSection.classList.add('slide-up'); // Add slide-up class for animation

                // // Ensure this ID exists in your HTML!
                // // const mappingCard = document.getElementById("mappingCard");
                // // if (mappingCard) mappingCard.style.display = "block";
                const compose = document.getElementById('composeSection');
                compose.style.display = 'block';
                
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
    
    // 1. Sanitize the HTML to block <script> tags
    const cleanBody = sanitizeEmailHTML(rawBody);

    // 2. Render the Preview
    document.getElementById('previewSubject').innerHTML = highlightVars(subj) || '(no subject)';
    document.getElementById('previewFrom').textContent = from || '(sender name)';
    
    // Use the sanitized HTML for the preview body
    document.getElementById('previewBody').innerHTML = highlightVars(cleanBody) || '(empty body)';
    
    // 3. Update Variable Badges (Your existing logic)
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
    // 1. Create a virtual document to parse the string
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHTML, 'text/html');

    // 2. Find and remove all <script> tags
    const scripts = doc.querySelectorAll('script');
    scripts.forEach(s => s.remove());

    // 3. Find and remove all 'on' event attributes (e.g., onclick, onerror)
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

function stopSending() {
    if (confirm("Are you sure you want to stop the sending process? You can resume later, and any failed records will be available for download.")) {
        shouldStopSending = true;
    }
}

function switchToDashboard() {
    // 1. Hide Config View
    document.getElementById('configView').classList.remove('view-active');
    document.getElementById('configView').style.display = 'none';

    // 2. Show Dashboard View
    const dash = document.getElementById('dashboardView');
    dash.classList.add('view-active');
    dash.style.display = 'block';

    // 3. Immediately trigger the bulk send
    sendBulkEmails();
}


async function sendBulkEmails(event) {
    if (event) event.preventDefault();
    failedRecords = []; // Reset failed records at the start of each send attempt

    if (!document.getElementById("emailColSelect").value) {
        alert("Please map the Recipient Email Column.");
        return;
    }
    
    const emailCol = document.getElementById('emailColSelect').value;
    const progressBody = document.getElementById('progressBody');

    const BATCH_SIZE = 20; // Set your batch size here
    const LONG_DELAY = 60000; // 60 seconds in milliseconds
    const SHORT_DELAY = 2000; // 2 seconds between emails

    // Show the progress card and clear previous results
    const total = currentSheetData.length;
    const counterEl = document.getElementById('overallCounter');
    document.getElementById('progressCard').style.display = 'block';
    progressBody.innerHTML = ''; 
    

    // Loop through each row of the current sheet data
    for (let i = 0; i < currentSheetData.length; i++) {
        const row = currentSheetData[i];
        const email = row[emailCol];
        const rawBody = document.getElementById('bodyEditor').value;

        if(shouldStopSending) {
            counterEl.textContent = `Process stopped by user. ${i} of ${total} emails processed.`;
            counterEl.style.color = "Red";
            break;
        }

        if (isPaused) {
            counterEl.textContent = `Paused... ${i} of ${total} emails processed.`;
            await checkPause();
        }

        document.getElementById("currentRecipientDisplay").textContent = `Current Recipient: ${email || '(no email found in this row)'}`;

        let previewBody = rawBody;
        // Replace variables in the preview body with actual values from the row
        Object.keys(row).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            previewBody = previewBody.replace(regex, row[key]);
        });

        document.getElementById("liveBodyContent").innerHTML = sanitizeEmailHTML(previewBody);
        
        // 1. UI: Create row and set to "Sending..."
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${email}</td>
            <td class="status-cell" style="padding: 8px; border-bottom: 1px solid #eee; color: orange;">Sending...</td>
        `;
        progressBody.appendChild(tr);
        const statusCell = tr.querySelector('.status-cell');

        // 2. Prepare Payload
        const payload = {
            auth: {
                user: document.getElementById("senderEmail").value,
                pass: document.getElementById("appPassword").value
            },
            recipient: email,
            subject: document.getElementById("subjectField").value,
            body: document.getElementById("bodyEditor").value,
            senderName: document.getElementById("senderName").value,
            rowData: row,
            extractDir: currentExtractDir,
            attachmentFileName: row[document.getElementById('attachmentColSelect').value]
        };

        // 3. Send Email
        try {
            const response = await fetch("http://localhost:3000/notify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if(result.success) {
                statusCell.textContent = "✅ Success";
                statusCell.style.color = "green";
            } else {
                statusCell.textContent = "❌ Failed";
                statusCell.style.color = "red";
                failedRecords.push({ ...row, Error_Reason: result.message || 'SMTP Reject' });
                document.getElementById('downloadFailedBtn').style.display = 'inline-block';
            }
        } catch (err) {
            statusCell.textContent = "⚠️ Error";
            failedRecords.push({ row, Error_Reason: err.message || 'Network/Server Error' });
            document.getElementById('downloadFailedBtn').style.display = 'inline-block';
        }

        

        // 4. BATCH LOGIC
        const count = i + 1; // Current number of emails processed
        const isLastEmail = count === currentSheetData.length;

        counterEl.textContent = `Processing: ${count} of ${total} emails sent...`;
        // 5. Update Counter, show the break message if needed, and continue to next email
        if (count % BATCH_SIZE === 0 && !isLastEmail) {
            // 1. Create a special "Pause Row"
            const pauseMsg = document.createElement('tr');
            pauseMsg.id = "pauseRow"; // ID so we can find and remove it later
            progressBody.appendChild(pauseMsg);

            // 2. Countdown logic for the pause
            let pauseCounter = 60;
            while (pauseCounter > 0) {
                pauseMsg.innerHTML = 
                `<td colspan="2" style="padding: 8px; border-bottom: 1px solid #eee; color: blue; text-align: center;">
                    Pausing for batch cooldown... Resuming in ${pauseCounter} seconds.
                </td>`;
                await new Promise(resolve => setTimeout(resolve, 1000));
                pauseCounter--;
            }

            // 3. Remove the message and continue
            pauseMsg.remove();
        }
        else if (!isLastEmail) {
            // Short delay between emails to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, SHORT_DELAY));
        }
    }
    counterEl.textContent = `Completed: All ${total} emails processed.`;
    counterEl.style.color = "green";

    document.getElementById("finishSection").style.display = "block";

    if (failedRecords.length > 0) {
        document.getElementById('downloadFailedBtn').style.display = 'inline-block';
    } else {
        document.getElementById('downloadFailedBtn').style.display = 'none';
    }

    alert("Bulk sending process completed!");
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