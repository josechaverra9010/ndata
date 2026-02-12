import express from 'express';
import PDFDocument from 'pdfkit';

const app = express();
const PORT = process.env.PORT || 8000;

// Simple CORS headers for local development
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/api/patients/:id/reports/nutrition', (req, res) => {
  const patientId = req.params.id;

  // Create a PDF document and stream it to the response
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="informe_nutricional_${patientId}.pdf"`);

  doc.pipe(res);

  doc.fontSize(18).text('Informe Nutricional Profesional', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Paciente ID: ${patientId}`);
  doc.text(`Generado: ${new Date().toLocaleString()}`);

  doc.moveDown();
  doc.fontSize(14).text('Resumen:', { underline: true });
  doc.fontSize(11).text('Este es un informe de ejemplo generado localmente.');

  doc.moveDown(2);
  doc.fontSize(10).text('Notas:', { underline: true });
  doc.fontSize(10).text('• Reemplaza este endpoint por la implementación real que incluya datos clínicos, evaluación, gráficos y firma del nutricionista.');

  doc.end();
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Report server listening on http://localhost:${PORT}`);
});
