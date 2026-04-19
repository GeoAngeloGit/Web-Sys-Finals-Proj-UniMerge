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

async function uploadFile() {
    const csvInput = document.getElementById("csvFile");
    const zipInput = document.getElementById("zipFile"); // Add this ID to your HTML

    if (!csvFile) {
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
            let message = "CSV uploaded successfully!";
            if (result.files.zipFile) {
                message += " ZIP uploaded successfully!";
            }
            document.getElementById("uploadStatus").textContent = message;

            initPills(result.headers); // Initialize the variable pills with the headers from the response
            initMappingDropdowns(result.headers); // Initialize the mapping UI with the headers

            document.getElementById("composeSection").style.display = "block"; // Show the mapping section

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