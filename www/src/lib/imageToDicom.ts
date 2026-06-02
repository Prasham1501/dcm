/**
 * Shared JPG/PNG/BMP → DICOM conversion helpers.
 *
 * Used by:
 *   - CreatePatientModal (convert at patient-creation time)
 *   - PatientActionBar  ("Import Non-DICOM Files" — append to existing patient)
 *   - PatientContextMenu (right-click → Import Non-DICOM Files)
 */

const IMAGE_EXTS = /\.(png|jpe?g|bmp)$/i;

export interface ConvertMeta {
  patient_name: string;
  patient_id: string;
  age: string;
  sex: string;
  modality: string;
  study_description: string;
  referring_physician: string;
  accession_number: string;
  /** Optional — reuse the same Study UID so appended images join the existing study. */
  study_instance_uid?: string;
}

export interface ConvertResult {
  files: string[];
  errors: string[];
}

function bmpAwareMime(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'bmp') return 'image/bmp';
  return 'image/jpeg';
}

/** POST image files to the PHP converter, retrying once on a 502 hiccup. */
export async function convertImagesToDicom(imageFiles: File[], meta: ConvertMeta): Promise<ConvertResult> {
  const buildForm = () => {
    const fd = new FormData();
    for (const f of imageFiles) fd.append('images[]', f);
    for (const [k, v] of Object.entries(meta)) {
      if (v != null) fd.append(k, String(v));
    }
    return fd;
  };

  let lastErr: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch('/api/dicom/convert-image.php', { method: 'POST', body: buildForm() });
      let data: any = null;
      try { data = await resp.json(); } catch { /* server didn't return JSON */ }
      if (resp.ok && data?.ok) return { files: data.files ?? [], errors: data.errors ?? [] };
      const msg = data?.error || `HTTP ${resp.status}`;
      const code = data?.code || (resp.status === 502 ? 'APACHE_DOWN' : 'PROXY_ERROR');
      lastErr = Object.assign(new Error(msg), { code });
      if (resp.status === 502 && attempt === 0) { await new Promise((r) => setTimeout(r, 800)); continue; }
      throw lastErr;
    } catch (e: any) {
      lastErr = e;
      if (attempt === 0 && /Failed to fetch|NetworkError|ECONNREFUSED/i.test(String(e?.message || ''))) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      throw e;
    }
  }
  throw lastErr ?? new Error('Image conversion failed');
}

/**
 * Open the OS file picker (Electron dialog when available, browser file
 * input otherwise) and return the selected images as File objects ready to
 * POST. Returns null when the user cancels.
 */
export async function pickImageFiles(): Promise<File[] | null> {
  const api = (window as any).electronAPI;
  if (api?.invoke) {
    try {
      const result = await api.invoke('show-open-dialog', {
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        title: 'Select Non-DICOM Image Files',
      });
      if (!result || result.canceled || !result.filePaths?.length) return null;
      const out: File[] = [];
      for (const fp of result.filePaths as string[]) {
        if (!IMAGE_EXTS.test(fp)) continue;
        try {
          const buf: ArrayBuffer = await api.invoke('read-file-buffer', fp);
          const name = fp.split(/[\\/]/).pop() || 'image.png';
          out.push(new File([buf], name, { type: bmpAwareMime(name) }));
        } catch { /* skip unreadable */ }
      }
      return out;
    } catch {
      // fall through to browser picker
    }
  }

  // Browser fallback — synthesise a hidden input
  return new Promise<File[] | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.png,.jpg,.jpeg,.bmp,image/png,image/jpeg,image/bmp';
    input.multiple = true;
    let settled = false;
    input.onchange = () => {
      settled = true;
      const files = Array.from(input.files || []).filter((f) => IMAGE_EXTS.test(f.name));
      resolve(files.length ? files : null);
    };
    // Detect cancel: focus returns to window without an onchange firing
    const onFocus = () => {
      setTimeout(() => {
        if (!settled) resolve(null);
        window.removeEventListener('focus', onFocus);
      }, 300);
    };
    window.addEventListener('focus', onFocus);
    input.click();
  });
}

export { IMAGE_EXTS };
