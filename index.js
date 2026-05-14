import { createTransport } from "nodemailer";
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import XLSX from 'xlsx';
import AdmZip from "adm-zip";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from 'url';
import mysql2 from 'mysql2';
import session from 'express-session';

const app = express();
const PORT = 3000;
const uploadDir = path.join(process.cwd(), "uploads");

// This tells Express to serve all files in the current folder as static assets
app.use(express.static(process.cwd()));

let sessionFolders = {}; // Track which files belong to which session

const storage = multer.diskStorage({
    destination(req, file, cb) {
        // Create a unique folder for THIS specific upload session
        const sessionId = req.headers['x-session-id'] || uuidv4();
        const sessionPath = path.join(uploadDir, sessionId);
        
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }
        cb(null, sessionPath);
    },
    filename(req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});


const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'unimerge_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));
app.use(express.static("frontend"));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.get("/auth", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend","auth.html"));
});

const database = mysql2.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'UniMerge WebSys'
});

database.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
    }
    else {
        console.log('Connected to the database.');
    }
});

import bcrypt from 'bcryptjs';

app.post('/register', (req, res) => {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
        return res.json({ success: false, field: 'email', message: 'All fields are required.' });
    }

    // 1. Check Password Requirements first (fastest check)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s])[\S]{8,}$/;
    if (!passwordRegex.test(password)) {
        return res.json({ 
            success: false, 
            field: 'password', 
            message: 'Must be 8+ chars, with upper, lower, number, and special char.' 
        });
    }

    // 2. Check if Email is Taken (Database query)
    database.query("SELECT Email FROM users WHERE Email = ?", [email], (err, results) => {
        if (err) {
            console.error('Check email error:', err);
            return res.status(500).json({ success: false, message: 'Server error.' });
        }

        if (results.length > 0) {
            return res.json({ success: false, field: 'email', message: 'Email is already taken.' });
        }

        // 3. ONLY proceed here after the email check is confirmed clear
        try {
            const hashedPassword = bcrypt.hashSync(password, 10);
            const query = 'INSERT INTO users (FullName, Email, HashedPassword) VALUES (?, ?, ?)';
            
            database.query(query, [name, email, hashedPassword], (insertErr, insertResults) => {
                if (insertErr) {
                    console.error('Error registering user:', insertErr);
                    return res.json({ success: false, field: 'email', message: 'Error saving user.' });
                }

                // SUCCESS: persist login state, then send JSON response
                req.session.userId = email;
                res.json({ success: true, message: 'Registration successful.' });
            });
        } catch (error) {
            console.error('Hashing error:', error);
            res.json({ success: false, field: 'email', message: 'Internal server error.' });
        }
    });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
        return res.json({ success: false, field: 'email', message: 'Email and password are required.' });
    }
    
    database.query("SELECT * FROM users WHERE Email = ?", [email], async (err, results) => {
        // Handle database errors
        if (err) {
            console.error('Database error:', err);
            return res.json({ success: false, field: 'email', message: 'Server error. Try again later.' });
        }
        
        if (results.length === 0) {
            return res.json({ success: false, field: 'email', message: 'Account not found.' });
        }

        const user = results[0]; // Get the user record from the database

        const isMatch = await bcrypt.compare(password, results[0].HashedPassword);
        if (!isMatch) {
            return res.json({ success: false, field: 'password', message: 'Wrong password. Try again.' });
        }

        // Store the numerical UserID from the database results
        req.session.userId = user.UserID; // Use the numerical ID from DB
        req.session.userName = user.FullName;

        console.log(`User Logged In: ${user.FullName} (ID: ${user.UserID})`);
        
        return res.json({ success: true, message: 'Login successful.' });
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

app.get("/api/user-status", (req, res) => {
    if(req.session.userId) {
        res.json({ loggedIn: true, userId: req.session.userId });
    } else {
        res.json({ loggedIn: false });
    }
});

// app.post('/api/send-bulk', async (req, res) => {
//     console.log("Request Body:", req.body);
//     const { subject, recipients, body, auth, senderName, extractDir } = req.body;
//     const userId = req.session.userId;

//     // Safety check: If recipients is missing, don't try to read .length
//     if (!recipients || !Array.isArray(recipients)) {
//         return res.status(400).json({ 
//             success: false, 
//             message: "Recipients list is missing or invalid." 
//         });
//     }

//     // 1. Create the Batch Entry
//     const batchQuery = 'INSERT INTO batches (UserID, Subject, TotalRecipients) VALUES (?, ?, ?)';
    
//     database.query(batchQuery, [userId, subject, recipients.length], async (err, result) => {
//         if (err) return res.status(500).json({ success: false, message: 'DB Error' });

//         const batchId = result.insertId;
//         let successCount = 0;

//         // Create the transporter ONCE, not inside the loop (better performance)
//         const transporter = createTransport({
//             service: "gmail",
//             auth: { user: auth.user, pass: auth.pass }
//         });

//         // 2. Loop through all recipients
//         for (const recipient of recipients) {
//             let status = 'Success';
//             let errorLog = null;
            
//             // recipient is now an object: { email: '...', rowData: { name: '...' }, attachmentFileName: '...' }
//             const { email, rowData, attachmentFileName } = recipient;

//             try {
//                 // Personalize content
//                 let finalBody = body;
//                 let finalSubject = subject;
//                 Object.keys(rowData).forEach(key => {
//                     const placeholder = new RegExp(`{{${key}}}`, 'g');
//                     finalBody = finalBody.replace(placeholder, rowData[key]);
//                     finalSubject = finalSubject.replace(placeholder, rowData[key]);
//                 });

//                 const mailOptions = {
//                     from: `"${senderName}" <${auth.user}>`,
//                     to: email,
//                     subject: finalSubject,
//                     html: finalBody,
//                     attachments: []
//                 };

//                 // Attachment logic
//                 if (extractDir && attachmentFileName) {
//                     const filePath = path.join(extractDir, attachmentFileName);
//                     if (fs.existsSync(filePath)) {
//                         mailOptions.attachments.push({ filename: attachmentFileName, path: filePath });
//                     }
//                 }

//                 await transporter.sendMail(mailOptions);
//                 successCount++;

//             } catch (sendError) {
//                 status = 'Failed';
//                 errorLog = sendError.message;
//             }

//             // 3. Insert individual log into batch_details
//             const detailQuery = "INSERT INTO batch_details (BatchID, RecipientEmail, Status, ErrorMessage) VALUES (?, ?, ?, ?)";
//             database.query(detailQuery, [batchId, email, status, errorLog]);
//         }

//         // 4. Final Updates and ONE SINGLE RESPONSE
//         const updateBatch = "UPDATE batches SET SuccessCount = ? WHERE BatchID = ?";
//         database.query(updateBatch, [successCount, batchId], () => {
//             // This is the ONLY place res.json should be called
//             res.json({ 
//                 success: true, 
//                 message: `Processed ${recipients.length} emails. ${successCount} successful.`,
//                 batchId: batchId 
//             });
//         });
//     });
// });

app.post('/api/send-bulk', async (req, res) => {
    console.log("--- New Batch Request Received ---");
    console.log("Recipients Count:", req.body.recipients ? req.body.recipients.length : "UNDEFINED");
    const { subject, recipients, body, auth, senderName, extractDir } = req.body;
    const userId = req.session.userId;

    // Safety: If not logged in, we can't save to the database
    if (!userId) {
        console.error("Error: No UserID in session!");
        return res.status(401).json({ success: false, message: "Please log in again." });
    }

    // Safety check
    if (!recipients || !Array.isArray(recipients)) {
        return res.status(400).json({ success: false, message: "No recipients provided" });
    }

    // 1. Create the Parent Batch
    const batchQuery = 'INSERT INTO batches (UserID, Subject, TotalRecipients) VALUES (?, ?, ?)';
    
    database.query(batchQuery, [userId, subject, recipients.length], async (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "DB Batch Error" });

        const batchId = result.insertId;
        let successCount = 0;

        const transporter = createTransport({
            service: "gmail",
            auth: { user: auth.user, pass: auth.pass }
        });

        // 2. Loop through the array
        for (const person of recipients) {
            let status = 'Success';
            let errorMsg = null;

            try {
                // Personalization Logic
                let finalBody = body;
                Object.keys(person.rowData).forEach(key => {
                    const placeholder = new RegExp(`{{${key}}}`, 'g');
                    finalBody = finalBody.replace(placeholder, person.rowData[key]);
                });

                await transporter.sendMail({
                    from: `"${senderName}" <${auth.user}>`,
                    to: person.email,
                    subject: subject,
                    html: finalBody
                    // Add attachment logic here
                });
                successCount++;

            } catch (e) {
                status = 'Failed';
                errorMsg = e.message;
            }

            // 3. Save individual Detail linked to BatchId
            const logQuery = "INSERT INTO batch_details (BatchID, RecipientEmail, Status, ErrorMessage) VALUES (?, ?, ?, ?)";
            database.query(logQuery, [batchId, person.email, status, errorMsg]);
        }

        // 4. Update total success count
        database.query("UPDATE batches SET SuccessCount = ? WHERE BatchID = ?", [successCount, batchId], () => {
            res.json({ success: true, batchId });
        });
    });
});

app.get('/api/batches', (req, res) => {
    const userId = req.session.userId;
    const sql = "SELECT * FROM batches WHERE UserID = ? ORDER BY SentDate DESC";

    database.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ success: false, message: 'Server error. Try again later.' });
        }
        res.json({ success: true, batches: results });
    })
});

app.get('/api/batch-details/:batchId', (req, res) => {
    const { batchId } = req.params;
    const sql = "SELECT * FROM bacth-details WHERE BatchID = ?";

    database.query(sql, [batchId], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ success: false, message: 'Server error. Try again later.' });
        }
        res.json({ success: true, details: results });
    });
});

app.post("/verify-connection", async (req, res) => {
    const { user, pass } = req.body;

    if (!user || !pass) {
        return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const transporter = createTransport({
        service: "gmail",
        auth: { user, pass }
    });

    try {
        await transporter.verify();
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Connection Verification Error:", error);
        res.status(401).json({ success: false, message: "Authentication failed. Please check your credentials." });
    }
});

app.post("/process-files", upload.fields([
    { name: "csvFile", maxCount: 1 },
    { name: "zipFile", maxCount: 1 },
]), (req, res) => {
    const csvFile = req.files?.csvFile?.[0];
    const zipFile = req.files?.zipFile?.[0];

    // Only CSV is strictly required for the data
    if (!csvFile) {
        return res.status(400).json({ success: false, message: "csvFile is required." });
    }

    try {
        // process the ZIP file if it exists (e.g., extract it, read contents, etc.)
        const excelFile = XLSX.readFile(csvFile.path);
        const sheetName = excelFile.SheetNames[0];
        const worksheet = excelFile.Sheets[sheetName];

        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const headers = rawData[0]; 

        // 2. NEW: Get all rows as objects for the sending loop
        const allRows = XLSX.utils.sheet_to_json(worksheet); 

        let extractDir = null;
        if(zipFile) {
            const zip = new AdmZip(zipFile.path);
            //create a new unique folder for the extracted content
            const folderName = `${Date.now()}-extracted`;
            extractDir = path.join(uploadDir, folderName);

            //extract everything to that folder
            zip.extractAllTo(extractDir, true);

            console.log(`ZIP extracted to ${extractDir}`);
        }

        res.status(200).json({
            success: true,
            message: zipFile ? "CSV and ZIP uploaded." : "CSV uploaded (No ZIP).",
            headers: headers,    // For the UI buttons
            allRows: allRows,    // NEW: For the sending loop
            extractDir: extractDir, // NEW: So frontend knows where files are
            files: {
                csvFile: csvFile.filename,
                zipFile: zipFile ? zipFile.filename : null,
            },
        });
    } catch (error) {
        console.error("Parsing Error:", error);
        res.status(500).json({ success: false, message: "Could not read the file content." });
    }

    
});

app.post("/cleanup", (req, res) => {
    const { extractDir } = req.body;

    if (!extractDir) {
        return res.status(400).json({ success: false, message: "No directory provided." });
    }

    try {
        // Find the parent session folder
        const sessionFolder = path.dirname(extractDir);

        if (fs.existsSync(sessionFolder)) {
            // Delete the entire folder and everything inside
            fs.rmSync(sessionFolder, { recursive: true, force: true });
            console.log(`Cleaned up session folder: ${sessionFolder}`);
            res.json({ success: true, message: "Session data wiped successfully." });
        } else {
            res.status(404).json({ success: false, message: "Folder not found." });
        }
    } catch (error) {
        console.error("Cleanup Error:", error);
        res.status(500).json({ success: false, message: "Failed to delete files." });
    }
});




//initialize the server and listen on the specified port
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
