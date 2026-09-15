/**
 * Read a browser `File` into a base64 data URL.
 *
 * The API accepts images as data URLs rather than multipart uploads, so both the
 * design repository and the business-logo upload need this. Kept in `shared/lib`
 * so the two features cannot drift apart.
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The selected image could not be read.'));
    reader.readAsDataURL(file);
  });
}
