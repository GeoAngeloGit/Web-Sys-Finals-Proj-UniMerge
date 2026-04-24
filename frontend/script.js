async function sendTest() {
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
                initPills(result.headers);
                initMappingDropdowns(result.headers);
                
                // Show the sections
                document.getElementById("composeSection").style.display = "block";
                // Ensure this ID exists in your HTML!
                const mappingCard = document.getElementById("mappingCard");
                if (mappingCard) mappingCard.style.display = "block";
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

function updatePreview(){
  const body = bodyEditor.value;
  const subj = subjectField.value;
  const from = senderName.value;
  
  document.getElementById('previewSubject').innerHTML = highlightVars(subj)||'<span style="color:var(--color-text-tertiary)">(no subject)</span>';
  document.getElementById('previewFrom').textContent = from||'(sender name)';
  document.getElementById('previewBody').innerHTML = highlightVars(body)||'<span style="color:var(--color-text-tertiary)">(empty body)</span>';
  
  const allText = body + ' ' + subj;
  const found = [...new Set([...allText.matchAll(/{{([\w_]+)}}/g)].map(m=>m[1]))];
  const usedEl = document.getElementById('usedVarsList');
  if(found.length===0){
    usedEl.textContent = 'None yet — insert variables above.';
  } 
  else {
    usedEl.innerHTML = found.map(v=>`<span class="mock-badge">{{${v}}}</span>`).join('');
  }
  document.querySelectorAll('.var-pill').forEach(p => {
    const key = p.dataset.key;
    p.classList.toggle('used', found.includes(key));
  });
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
    document.getElementById('mappingCard').style.display = 'block';
    document.getElementById('composeSection').style.display = 'block';
}

// Variable to store the headers/data from the upload step
let currentSheetData = []; 

async function sendBulkEmails(event) {
    if (event) event.preventDefault();
    
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
            statusCell.textContent = result.success ? "✅ Success" : "❌ Failed";
            statusCell.style.color = result.success ? "green" : "red";
        } catch (err) {
            statusCell.textContent = "⚠️ Error";
        }

        

        // 4. BATCH LOGIC
        const count = i + 1; // Current number of emails processed
        const isLastEmail = count === currentSheetData.length;

        // if (!isLastEmail) {
        //     if (count % BATCH_SIZE === 0) {
        //         // End of a batch! Wait 60 seconds
        //         console.log(`Batch of ${BATCH_SIZE} reached. Waiting 60 seconds...`);
                
        //         // Optional UI update to show the pause
        //         const pauseMsg = document.createElement('tr');
        //         pauseMsg.innerHTML = `<td colspan="2" style="text-align:center; background:#f9f9f9; font-style:italic;">Batch limit reached. Cooling down for 60s...</td>`;
        //         progressBody.appendChild(pauseMsg);

        //         await new Promise(resolve => setTimeout(resolve, LONG_DELAY));
        //         pauseMsg.remove(); // Remove the message when moving to next batch
        //     } else {
        //         // Just a normal individual delay
        //         await new Promise(resolve => setTimeout(resolve, SHORT_DELAY));
        //     }
        // }

        counterEl.textContent = `Processing: ${count} of ${total} emails sent...`;
        // 5. Update Counter, show the break message if needed, and continue to next email
        if (count % BATCH_SIZE === 0) {
            // 1. Create a special "Pause Row"
            const pauseMsg = document.createElement('tr');
            pauseMsg.id = "pauseRow"; // ID so we can find and remove it later
            pauseMsg.innerHTML = `
                <td colspan="2" style="text-align:center; background:#fff3cd; color: #856404; padding: 10px; font-style:italic;">
                    ☕ Batch limit reached. Cooling down for 60 seconds to prevent spam flags...
                </td>
            `;
            progressBody.appendChild(pauseMsg);

            // 2. Wait for the 60 seconds
            await new Promise(resolve => setTimeout(resolve, LONG_DELAY));

            // 3. Remove the message and continue
            pauseMsg.remove();
        }
    }
    counterEl.textContent = `Completed: All ${total} emails processed.`;
    counterEl.style.color = "green";
    alert("Bulk sending process completed!");
}