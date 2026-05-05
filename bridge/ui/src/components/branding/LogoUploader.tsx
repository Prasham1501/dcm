import { Upload, X } from 'lucide-react';

interface LogoUploaderProps {
  logoDataUrl: string;
  onChange: (dataUrl: string) => void;
}

export function LogoUploader({ logoDataUrl, onChange }: LogoUploaderProps) {
  const handlePick = async () => {
    try {
      const dataUrl = await window.bridgeAPI.pickAndEncodeLogo();
      if (dataUrl) onChange(dataUrl);
    } catch (e: any) {
      alert(e?.message || 'Failed to load logo');
    }
  };

  return (
    <div className="flex items-center gap-3">
      {logoDataUrl ? (
        <div className="relative">
          <img
            src={logoDataUrl}
            alt="Logo"
            className="h-14 w-14 rounded-lg border border-app-border object-cover"
          />
          <button
            onClick={() => onChange('')}
            title="Remove logo"
            className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-app-border text-app-text-secondary">
          <Upload className="h-5 w-5" />
        </div>
      )}
      <button
        onClick={handlePick}
        className="rounded border border-app-border px-3 py-1.5 text-xs text-app-text hover:bg-app-hover"
      >
        {logoDataUrl ? 'Change Logo' : 'Pick Logo'}
      </button>
    </div>
  );
}
