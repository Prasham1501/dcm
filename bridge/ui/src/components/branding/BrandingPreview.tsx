import { useMemo } from 'react';
import { buildBrandHeaderHtml, buildFooterHtml } from '@/lib/brandingHtml';
import type { HospitalBranding } from '@/types/bridge';

interface BrandingPreviewProps {
  branding: HospitalBranding;
}

export function BrandingPreview({ branding }: BrandingPreviewProps) {
  const headerHtml = useMemo(() => buildBrandHeaderHtml(branding), [branding]);
  const footerHtml = useMemo(
    () => (branding.enableFooter !== false ? buildFooterHtml(branding) : ''),
    [branding]
  );

  if (!branding.hospitalName) {
    return (
      <div className="flex h-32 items-center justify-center rounded border border-dashed border-app-border text-xs text-app-text-secondary">
        Enter a hospital name to see a live preview
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded border border-app-border bg-white">
      {headerHtml && (
        <div dangerouslySetInnerHTML={{ __html: headerHtml }} />
      )}
      <div className="flex h-16 items-center justify-center bg-gray-100 text-xs text-gray-400">
        [ Image grid area ]
      </div>
      {footerHtml && (
        <div dangerouslySetInnerHTML={{ __html: footerHtml }} />
      )}
    </div>
  );
}
