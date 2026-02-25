/**
 * Utility to download a file from a Fetch API Response
 * Extracts the filename from the Content-Disposition header if available
 */
export async function downloadFileFromResponse(response: Response, defaultFilename: string = 'document.pdf') {
    if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);

    // Extract filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = defaultFilename;

    if (contentDisposition) {
        // Look for filename="name.ext" or filename=name.ext
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(contentDisposition);
        if (matches != null && matches[1]) {
            filename = matches[1].replace(/['"]/g, '');
        }
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

/**
 * Open a document in a new tab using the secure token system
 * This is the preferred method for viewing documents natively in the browser
 */
export function openSecureView(viewUrl: string) {
    window.open(viewUrl, '_blank');
}
