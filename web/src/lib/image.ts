const MAX_EDGE = 1400;
const MAX_BYTES = 1_800_000; // the bucket limit is 2 MB
const OK_TYPE = /^image\/(jpeg|png|webp)$/;

/** Phone photos are huge. Shrink to a JPEG that uploads fast on a slow connection and fits the 2 MB limit. */
export async function prepareReceipt(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a photo (JPG, PNG or WebP).');
  if (file.size <= 400_000 && OK_TYPE.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
    if (!blob) throw new Error('encode failed');
    return new File([blob], 'receipt.jpg', { type: 'image/jpeg' });
  } catch {
    if (file.size <= MAX_BYTES && OK_TYPE.test(file.type)) return file;
    throw new Error('We couldn’t read that photo. Try a JPG or PNG under 2 MB.');
  }
}
