import { createTransport } from "nodemailer";
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import XLSX from 'xlsx';
import AdmZip from "adm-zip";
import { v4 as uuidv4 } from "uuid";

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

app.post("/notify", async (req, res) => {
    const { auth, recipient, subject, body, senderName, rowData, extractDir, attachmentFileName } = req.body;

    try {
        const transporter = createTransport({
            service: "gmail",
            auth: { user: auth.user, pass: auth.pass }
        });

        // Personalize the Body and Subject using rowData
        let finalBody = body;
        let finalSubject = subject;
        
        Object.keys(rowData).forEach(key => {
            const placeholder = new RegExp(`{{${key}}}`, 'g');
            finalBody = finalBody.replace(placeholder, rowData[key]);
            finalSubject = finalSubject.replace(placeholder, rowData[key]);
        });

        const mailOptions = {
            from: `"${senderName}" <${auth.user}>`,
            to: recipient,
            subject: finalSubject,
            html: finalBody,
            attachments: [] // Initialize empty
        };

        // NEW: Attachment Path Matching
        if (extractDir && attachmentFileName) {
            // We assume the files are PDFs. Adjust if they are images!
            const filePath = path.join(extractDir, `${attachmentFileName}`);
            
            if (fs.existsSync(filePath)) {
                mailOptions.attachments.push({
                    filename: `${attachmentFileName}`,
                    path: filePath
                });
            } else {
                console.warn(`File not found: ${filePath}`);
            }
        }

        const info = await transporter.sendMail(mailOptions);

        if(info.rejected.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Email rejected by SMTP server: ${info.rejected.join(', ')}` });
        }
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
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
