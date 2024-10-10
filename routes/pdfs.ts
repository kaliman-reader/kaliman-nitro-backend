import { _Object, PutObjectCommand, S3 } from "@aws-sdk/client-s3";
import { PDFDocument } from "pdf-lib";

const s3 = new S3({
  region: process.env.BUCKET_REGION,
});

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const prefix = query.prefix as string;
  const name = "exports/" + prefix.replace(/(\/[^$])+/g, "-") + ".pdf";
  await buildPdf(prefix, name);
  return getSignedUrl(process.env.EXPORT_BUCKET_NAME, name);
});

async function buildPdf(prefix: string, name: string): Promise<Uint8Array> {
  try {
    const pdfFound = await getObject(s3, process.env.EXPORT_BUCKET_NAME, name);
    return pdfFound;
  } catch (e) {
    const images = (await getPrefixes(s3, prefix)) as _Object[];
    const pdf = await createPdfFromImages(images.map((i) => i.Key));
    await uploadPdfToS3(name, pdf);
    return pdf;
  }
}

async function createPdfFromImages(images: string[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  for (const imagePath of images) {
    const imageBytes = await getObject(s3, process.env.BUCKET_NAME, imagePath);

    // Embed the image into the document
    const embeddedImage = await pdfDoc.embedJpg(imageBytes); // For JPGs
    // Use pdfDoc.embedPng(imageBytes) if the image is PNG

    // Get image dimensions
    const { width, height } = embeddedImage.scale(1);

    // Add a blank page with the image's size
    const page = pdfDoc.addPage([width, height]);

    // Draw the image on the page
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: width,
      height: height,
    });
  }

  return pdfDoc.save();
}

async function uploadPdfToS3(name: string, pdf: Uint8Array): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.EXPORT_BUCKET_NAME,
    Key: name,
    Body: pdf,
    ContentType: "application/pdf",
  });
  await s3.send(command);
  return name;
}
