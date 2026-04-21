/**
 * DICOM Image Loader - Manages loading images from various sources.
 * Supports: local files (via wadouri), Orthanc PACS, drag-drop files, and File API.
 */
import { cornerstone, cornerstoneWADOImageLoader } from './cornerstoneSetup';

// Detect Electron and use its DICOM server port
const isElectron = !!(window as any).electronAPI?.isElectron;
let DICOM_API_BASE = '/api';

// In Electron, DICOM files are served by a local Node.js server on port 3457
if (isElectron) {
  DICOM_API_BASE = 'http://localhost:3457/api';
}

const API_BASE = '/api';

export interface DicomFileInfo {
  path: string;
  filename: string;
  size: number;
}

/**
 * Build a wadouri imageId from a local file path
 * The path is served through our PHP proxy endpoint
 */
export function localFileToImageId(filePath: string): string {
  // Normalize Windows backslashes to forward slashes for URL encoding
  const normalized = filePath.replace(/\\/g, '/');
  const encodedPath = encodeURIComponent(normalized);
  return `wadouri:${DICOM_API_BASE}/dicom/serve-file.php?path=${encodedPath}`;
}

/**
 * Build a wadouri imageId from an Orthanc instance ID
 */
export function orthancToImageId(instanceId: string): string {
  return `wadouri:${API_BASE}/dicom/serve-file.php?orthanc_id=${encodeURIComponent(instanceId)}`;
}

/**
 * Build a wadouri imageId from a DICOMweb URL
 */
export function wadouriToImageId(studyUID: string, seriesUID: string, instanceUID: string): string {
  return `wadouri:${API_BASE}/dicomweb/instance-file.php?studyUID=${encodeURIComponent(studyUID)}&seriesUID=${encodeURIComponent(seriesUID)}&instanceUID=${encodeURIComponent(instanceUID)}`;
}

/**
 * Load a DICOM file from a browser File object (drag-drop or file input).
 * Returns a cornerstone imageId that can be displayed.
 */
export function fileToImageId(file: File): string {
  return cornerstoneWADOImageLoader.wadouri.fileManager.add(file);
}

/**
 * Check if a file is likely a DICOM file.
 * Accepts: .dcm, .dicom, .dic, extensionless, and common DICOM patterns.
 * Rejects: clearly non-DICOM files (.txt, .jpg, .png, .xml, .json, etc.)
 */
function isDicomFile(file: File): boolean {
  const name = file.name.toLowerCase();
  // Known DICOM extensions
  if (name.endsWith('.dcm') || name.endsWith('.dicom') || name.endsWith('.dic')) return true;
  // No extension (common for DICOM)
  if (!name.includes('.')) return true;
  // DICOMDIR
  if (name === 'dicomdir') return true;
  // Reject known non-DICOM
  const nonDicom = ['.txt', '.xml', '.json', '.csv', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.pdf', '.html', '.htm', '.js', '.css', '.md', '.log', '.ini', '.cfg', '.zip', '.rar', '.exe', '.dll', '.bat', '.sh'];
  const ext = '.' + name.split('.').pop();
  if (nonDicom.includes(ext)) return false;
  // Accept anything else (could be DICOM with unusual naming)
  return true;
}

/**
 * Load multiple files from a FileList (drag-drop or file input).
 * Returns imageIds for DICOM files.
 */
export function filesToImageIds(files: FileList | File[]): string[] {
  const imageIds: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (isDicomFile(file)) {
      imageIds.push(fileToImageId(file));
    }
  }
  return imageIds;
}

/**
 * Scan a local directory via PHP API and return imageIds.
 */
export async function scanLocalDirectory(dirPath: string, limit = 100): Promise<{
  imageIds: string[];
  files: DicomFileInfo[];
}> {
  const response = await fetch(
    `${DICOM_API_BASE}/dicom/scan-local.php?dir=${encodeURIComponent(dirPath)}&limit=${limit}`
  );
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to scan directory');
  }

  const imageIds = data.files.map((f: DicomFileInfo) => localFileToImageId(f.path));
  return { imageIds, files: data.files };
}

/**
 * Prefetch an image (loads into cache without displaying).
 */
export function prefetchImage(imageId: string): Promise<void> {
  return cornerstone.loadImage(imageId).then(() => {});
}

/**
 * Prefetch a batch of images with concurrency control.
 */
export async function prefetchImages(
  imageIds: string[],
  concurrency = 4,
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  let loaded = 0;
  const total = imageIds.length;
  const queue = [...imageIds];

  const worker = async () => {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) break;
      try {
        await prefetchImage(id);
      } catch {
        // skip failed images
      }
      loaded++;
      onProgress?.(loaded, total);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);
}

/**
 * Get DICOM metadata from a loaded image.
 */
export function getImageMetadata(imageId: string): Promise<Record<string, any>> {
  return cornerstone.loadImage(imageId).then((image: any) => {
    const metadata: Record<string, any> = {
      rows: image.rows,
      columns: image.columns,
      width: image.width,
      height: image.height,
      windowCenter: image.windowCenter,
      windowWidth: image.windowWidth,
      minPixelValue: image.minPixelValue,
      maxPixelValue: image.maxPixelValue,
      slope: image.slope,
      intercept: image.intercept,
      invert: image.invert,
      photometricInterpretation: image.photometricInterpretation,
      bitsAllocated: image.bitsAllocated,
      bitsStored: image.bitsStored,
      pixelRepresentation: image.pixelRepresentation,
      color: image.color,
    };
    return metadata;
  });
}

/**
 * Purge cornerstone image cache to free memory.
 */
export function purgeCache(): void {
  try {
    cornerstone.imageCache.purgeCache();
  } catch {
    // ignore
  }
}
