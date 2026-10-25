<?php
// Generate a clean, valid sample PDF for testing PDF.js rendering
$pdfContent = "%PDF-1.4\n" .
"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n" .
"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n" .
"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 420] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n" .
"4 0 obj << /Length 210 >> stream\n" .
"BT\n" .
"/F1 20 Tf\n" .
"50 360 Td\n" .
"(RHU II - YAKAP PRESCRIPTION) Tj\n" .
"/F1 12 Tf\n" .
"0 -30 Td\n" .
"(Patient: Juan Dela Cruz   |   Queue: #5   |   Date: 2026-10-25) Tj\n" .
"0 -25 Td\n" .
"(Rx: Amoxicillin 500mg capsules #21) Tj\n" .
"0 -20 Td\n" .
"(Sig: Take 1 capsule three times daily for 7 days.) Tj\n" .
"0 -35 Td\n" .
"(Physician: Doc. Renz Sale, MD - PRC 0148921) Tj\n" .
"ET\n" .
"endstream\n" .
"endobj\n" .
"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n" .
"xref\n" .
"0 6\n" .
"0000000000 65535 f \n" .
"0000000009 00000 n \n" .
"0000000058 00000 n \n" .
"0000000115 00000 n \n" .
"0000000244 00000 n \n" .
"0000000507 00000 n \n" .
"trailer << /Size 6 /Root 1 0 R >>\n" .
"startxref\n" .
"576\n" .
"%%EOF\n";

file_put_contents(__DIR__ . '/../public/sample_yakap_prescription.pdf', $pdfContent);
echo "Generated public/sample_yakap_prescription.pdf (" . strlen($pdfContent) . " bytes)\n";
