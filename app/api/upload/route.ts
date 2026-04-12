import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  secure: true
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const relatedItemTitle = formData.get('title') || 'Lume Upload';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            { resource_type: 'auto', folder: 'sciastra_contentos' },
            (error, result) => {
                if (error) {
                    console.error("Cloudinary upload failed", error);
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        ).end(buffer);
    });

    // We can also trigger the WhatsApp Webhook automatically to alert the SMM here
    // However, it's safer to do this from the Client-Side to orchestrate the "sent" toast UX

    return NextResponse.json({ success: true, asset: result });

  } catch (err: any) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
