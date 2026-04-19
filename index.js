import { createTransport } from "nodemailer";
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import XLSX from 'xlsx';
import AdmZip from "adm-zip";

const app = express();
const PORT = 3000;
const uploadDir = path.join(process.cwd(), "uploads");

const storage = multer.diskStorage({
    destination(req, file, cb) {
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename(req, file, cb) {
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext);
        cb(null, `${Date.now()}-${base}${ext}`);
    },
});

const upload = multer({ storage });

app.use(cors());
app.use(express.json());

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
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const headers = data[0]; // This is your array of column names!
        console.log("Extracted Headers:", data[0]); // Log the headers for debugging

        if(zipFile) {
            const zip = new AdmZip(zipFile.path);
            //create a new unique folder for the extracted content
            const extractDir = path.join(uploadDir, `${Date.now()}-extracted`);

            //extract everything to that folder
            zip.extractAllTo(extractDir, true);

            console.log(`ZIP extracted to ${extractDir}`);
        }

        res.status(200).json({
            success: true,
            message: zipFile ? "CSV and ZIP uploaded." : "CSV uploaded (No ZIP).",
            headers: headers, // Send the headers back to the frontend
            files: {
                csvFile: csvFile.filename,
                zipFile: zipFile ? zipFile.filename : null, // Handle the optional case
            },
        });
    } catch (error) {
        console.error("Parsing Error:", error);
        res.status(500).json({ success: false, message: "Could not read the file content." });
    }

    
});

app.post("/notify", async (req, res) => {

    const { senderEmail, appPassword, recipientEmail, subject, message } = req.body;

    const transporter = createTransport({
        host: "smtp.gmail.com",
        port: 465, //port of SMTP dont change
        secure: true, // use STARTTLS (upgrade connection to TLS after connecting)
        //authenticate the email of the sender
        auth: {
            user: senderEmail, //email address of the sender
            pass: appPassword, //app password of the gmail address
        },
    });

    try {
        await transporter.sendMail({
            from: senderEmail, // sender address
            to: recipientEmail, // list of recipients
            subject: subject, // subject line
            text: message, // plain text body
        });

        res.status(200).send({ success: true, message: "Email sent successfully!" });
        } 
        catch (err) {
            console.error("Error while sending mail:", err);
            res.status(500).send({ success: false, message: "Failed to send email." });
        }
});




//initialize the server and listen on the specified port
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
