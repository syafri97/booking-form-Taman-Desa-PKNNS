require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const fs = require('fs');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const path = require('path');
const open = require('open').default;

const app = express();

// CORS middleware betul, letak paling atas
app.use(cors({
    origin: [ 'https://booking-form-taman-desa-pknns.onrender.com'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: false // kalau tak guna cookies, boleh false
}));

// Middleware untuk tambah header CORS tambahan jika perlu
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*"); // hanya untuk ujian
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    next();
});

// Handle preflight OPTIONS request dengan jawapan manual (optional tapi bagus untuk debugging)
app.options('/submitBooking', (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.sendStatus(200);
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

function drawWrappedText(page, text, x, y, font, size, maxWidth, lineHeight = 12) {
    const words = text.split(' ');
    let line = '';
    let lines = [];

    for (let word of words) {
        const testLine = line + word + ' ';
        const width = font.widthOfTextAtSize(testLine, size);
        if (width > maxWidth) {
            lines.push(line.trim());
            line = word + ' ';
        } else {
            line = testLine;
        }
    }
    lines.push(line.trim());

    lines.forEach((lineText, index) => {
        page.drawText(lineText, {
            x,
            y: y - (index * lineHeight),
            size,
            font,
            color: rgb(0, 0, 0)
        });
    });
}

async function generateFilledPdf(templatePath, data) {
    const pdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const mm = 2.83;
    let positions;
    let signaturePosition;

    switch (templatePath) {
        case './templates/booking-template.pdf':
            positions = {
                customerName1: { x: 19 * mm, y: 176 * mm, size: 7 },
                customerName2: { x: 28 * mm, y: 28 * mm, size: 10 },
                customerIc: { x: 91.31 * mm, y: 176 * mm, size: 9 },
                customerAddress: { x: 67 * mm, y: 153 * mm, size: 8 },
                customerPhone: { x: 129.28 * mm, y: 176 * mm, size: 9 },
                customerRace: { x: 68.85 * mm, y: 176 * mm, size: 9 },
                customerEmail: { x: 155 * mm, y: 176 * mm, size: 8 },
                submissionDate1: { x: 154 * mm, y: 115 * mm, size: 10 },
                submissionDate2: { x: 28 * mm, y: 22 * mm, size: 10 },
                submissionDate3: { x: 124 * mm, y: 22 * mm, size: 10 }
            };
            signaturePosition = { x: 36 * mm, y: 35 * mm };
            break;

        case './templates/pdpa1-template.pdf':
            positions = {
                customerName: { x: 67 * mm, y: 60.5 * mm, size: 12 },
                customerIc: { x: 67 * mm, y: 52 * mm, size: 12 },
                customerPhone: { x: 67 * mm, y: 44 * mm, size: 12 },
                submissionDate: { x: 143 * mm, y: 24.5 * mm, size: 10 }
            };
            signaturePosition = { x: 65 * mm, y: 25 * mm };
            break;

        case './templates/borang2-template.pdf':
            positions = {
                customerName1: { x: 51 * mm, y: 221 * mm, size: 10 },
                customerName2: { x: 30 * mm, y: 38 * mm, size: 10 },
                submissionDate1: { x: 51 * mm, y: 229 * mm, size: 10 },
                submissionDate2: { x: 30 * mm, y: 31 * mm, size: 10 }
            };
            signaturePosition = { x: 40 * mm, y: 45 * mm };
            break;

        case './templates/borang3-template.pdf':
            positions = {
                customerName: { x: 25 * mm, y: 67 * mm, size: 10 },
                customerIc: { x: 32 * mm, y: 61.5 * mm, size: 10 },
                customerPosition: { x: 34 * mm, y: 56 * mm, size: 10 },
                customerPhone: { x: 39 * mm, y: 50 * mm, size: 10 }
            };
            signaturePosition = { x: 41 * mm, y: 78 * mm };
            break;

        default:
            positions = {};
            signaturePosition = { x: 65 * mm, y: 25 * mm };
    }

    for (const key in positions) {
        if (positions[key] && data[key]) {
            if (key === 'customerAddress') {
                drawWrappedText(firstPage, data[key].toString(), positions[key].x, positions[key].y, font, positions[key].size, 120);
            } else {
                firstPage.drawText(data[key].toString(), {
                    x: positions[key].x,
                    y: positions[key].y,
                    size: positions[key].size,
                    font,
                    color: rgb(0, 0, 0)
                });
            }
        }
    }

    if (data.signatureData && data.signatureData.startsWith('data:image')) {
        const signatureImage = await pdfDoc.embedPng(data.signatureData);
        firstPage.drawImage(signatureImage, {
            x: signaturePosition.x,
            y: signaturePosition.y,
            width: 150,
            height: 50
        });
    }

    return await pdfDoc.save();
}

app.post('/submitBooking', async (req, res) => {
    const {
        customerName,
        customerIc,
        customerAddress,
        customerPhone,
        customerPosition,
        customerRace,
        customerEmail,
        signatureData
    } = req.body;

    const submissionDate = new Date().toLocaleDateString();
    const requiredTemplates = [
        './templates/booking-template.pdf',
        './templates/pdpa1-template.pdf',
        './templates/borang2-template.pdf',
        './templates/borang3-template.pdf'
    ];

    const generatedFiles = [];
    const outputDir = path.join(__dirname, 'temp');

    try {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        for (const templatePath of requiredTemplates) {
            const filledPdfBytes = await generateFilledPdf(templatePath, {
                customerName,
                customerIc,
                customerAddress,
                customerPhone,
                customerPosition,
                customerRace,
                customerEmail,
                signatureData,
                submissionDate,
                submissionDate1: submissionDate,
                submissionDate2: submissionDate,
                submissionDate3: submissionDate
            });

            const fileName = `booking_${path.basename(templatePath, '.pdf')}_${Date.now()}.pdf`;
            const outputPath = path.join(outputDir, fileName);
            fs.writeFileSync(outputPath, filledPdfBytes);
            generatedFiles.push(outputPath);
        }

        await transporter.sendMail({
            from: `Borang Tempahan <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER,
            subject: 'Borang Tempahan Diterima',
            text: 'Borang tempahan telah diterima.',
            attachments: generatedFiles.map(filePath => ({
                filename: path.basename(filePath),
                path: filePath
            }))
        });

        res.status(200).json({ message: 'Borang tempahan berjaya dihantar.' });
    } catch (error) {
        res.status(500).json({ message: 'Terjadi masalah. Sila cuba lagi.', error: error.message });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    const link = `http://localhost:${port}`;
    console.log(`Server berjalan pada: ${link}`);
    open(link);
});
