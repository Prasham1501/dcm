import { useHospitalConfigStore } from '@/stores/hospitalConfigStore';

export function PrintSettingsTab() {
  const config = useHospitalConfigStore();

  return (
    <div className="space-y-5 text-xs">
      {/* Header/Footer Font */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">
          Header / Footer Font
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-app-text-muted uppercase w-28">Header Font Size</label>
            <input type="number" min={6} max={24} value={config.headerFontSize}
              onChange={(e) => config.updateField('headerFontSize', parseInt(e.target.value) || 10)}
              className="w-16 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
            />
            <span className="text-app-text-muted">px</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-app-text-muted uppercase w-28">Header Font Color</label>
            <input type="color" value={config.headerFontColor}
              onChange={(e) => config.updateField('headerFontColor', e.target.value)}
              className="w-8 h-7 bg-transparent border-none cursor-pointer"
            />
            <span className="text-app-text font-mono text-[10px]">{config.headerFontColor}</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-app-text-muted uppercase w-28">Footer Font Size</label>
            <input type="number" min={6} max={24} value={config.footerFontSize}
              onChange={(e) => config.updateField('footerFontSize', parseInt(e.target.value) || 8)}
              className="w-16 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
            />
            <span className="text-app-text-muted">px</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-app-text-muted uppercase w-28">Footer Font Color</label>
            <input type="color" value={config.footerFontColor}
              onChange={(e) => config.updateField('footerFontColor', e.target.value)}
              className="w-8 h-7 bg-transparent border-none cursor-pointer"
            />
            <span className="text-app-text font-mono text-[10px]">{config.footerFontColor}</span>
          </div>
        </div>
      </div>

      {/* Print Background & Border */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">
          Background & Border
        </h3>
        <div className="space-y-2">
          <CheckboxRow label="Print black background non-US modality" checked={config.printBlackBgNonUS}
            onChange={(v) => config.updateField('printBlackBgNonUS', v)} />
          <CheckboxRow label="Print black background US modality" checked={config.printBlackBgUS}
            onChange={(v) => config.updateField('printBlackBgUS', v)} />
          <CheckboxRow label="Print border to image" checked={config.printBorderToImage}
            onChange={(v) => config.updateField('printBorderToImage', v)} />
          <div className="flex items-center gap-2 ml-5">
            <label className="text-[10px] font-bold text-app-text-muted uppercase w-28">Border Color</label>
            <input type="color" value={config.printBorderColor}
              onChange={(e) => config.updateField('printBorderColor', e.target.value)}
              className="w-8 h-7 bg-transparent border-none cursor-pointer"
            />
            <span className="text-app-text font-mono text-[10px]">{config.printBorderColor}</span>
          </div>
          <div className="flex items-center gap-2 ml-5">
            <label className="text-[10px] font-bold text-app-text-muted uppercase w-28">Viewport Border</label>
            <input type="color" value={config.viewportBorderColor}
              onChange={(e) => config.updateField('viewportBorderColor', e.target.value)}
              className="w-8 h-7 bg-transparent border-none cursor-pointer"
            />
            <span className="text-app-text font-mono text-[10px]">{config.viewportBorderColor}</span>
          </div>
        </div>
      </div>

      {/* Print Count & Popup */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">
          Print Count & Notifications
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-app-text-muted uppercase w-40">Print count warning at</label>
            <input type="number" min={0} max={9999} value={config.printCountWarningAt}
              onChange={(e) => config.updateField('printCountWarningAt', parseInt(e.target.value) || 50)}
              className="w-20 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
            />
          </div>
          <CheckboxRow label="Popup window when image received" checked={config.popupOnImageReceived}
            onChange={(v) => config.updateField('popupOnImageReceived', v)} />
        </div>
      </div>

      {/* Export Folder Name */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">
          Export Folder Name
        </h3>
        <div className="space-y-1.5">
          <RadioRow label="Patient Name" checked={config.exportFolderNameMode === 'patientName'}
            onChange={() => config.updateField('exportFolderNameMode', 'patientName')} name="exportFolder" />
          <RadioRow label="Id-Name-Gender-Age" checked={config.exportFolderNameMode === 'idNameGenderAge'}
            onChange={() => config.updateField('exportFolderNameMode', 'idNameGenderAge')} name="exportFolder" />
        </div>
      </div>

      {/* Metadata to Print */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">
          Metadata to Print
        </h3>
        <div className="space-y-2">
          <CheckboxRow label="Ref by / Done by" checked={config.metadataPrintRefBy}
            onChange={(v) => config.updateField('metadataPrintRefBy', v)} />
          <CheckboxRow label="Study name" checked={config.metadataPrintStudyName}
            onChange={(v) => config.updateField('metadataPrintStudyName', v)} />
          <CheckboxRow label="Accession No" checked={config.metadataPrintAccessNo}
            onChange={(v) => config.updateField('metadataPrintAccessNo', v)} />
          <CheckboxRow label="Patient ID" checked={config.metadataPrintPatientId}
            onChange={(v) => config.updateField('metadataPrintPatientId', v)} />
        </div>
      </div>

      {/* Image Spacing */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">
          Image Spacing
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-app-text-muted uppercase w-40">Gap between images</label>
            <input type="number" min={0} max={200} value={config.gapBetweenImages}
              onChange={(e) => config.updateField('gapBetweenImages', parseInt(e.target.value) || 0)}
              className="w-20 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
            />
            <span className="text-app-text-muted">px</span>
          </div>
          <div>
            <label className="text-[10px] font-bold text-app-text-muted uppercase mb-1 block">6 Spots Spacing</label>
            <div className="space-y-1 ml-2">
              <RadioRow label="Keep equal space at top and bottom" checked={config.sixSpotsSpacing === 'equalSpace'}
                onChange={() => config.updateField('sixSpotsSpacing', 'equalSpace')} name="sixSpots" />
              <RadioRow label="Compact (minimize spacing)" checked={config.sixSpotsSpacing === 'compact'}
                onChange={() => config.updateField('sixSpotsSpacing', 'compact')} name="sixSpots" />
            </div>
          </div>
        </div>
      </div>

      {/* Logo / Banner */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">
          Logo or Banner
        </h3>
        <div className="space-y-2">
          <CheckboxRow label="Logo left OR Banner portrait" checked={config.logoLeftEnabled}
            onChange={(v) => config.updateField('logoLeftEnabled', v)} />
          <div className="flex items-center gap-2 ml-5">
            <label className="text-[10px] font-bold text-app-text-muted uppercase w-28">Height (inch)</label>
            <input type="number" min={0.1} max={5} step={0.1} value={config.logoLeftHeight}
              onChange={(e) => config.updateField('logoLeftHeight', parseFloat(e.target.value) || 0.5)}
              className="w-20 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 ml-5">
            <label className="text-[10px] font-bold text-app-text-muted uppercase w-28">Logo right path</label>
            <input type="text" value={config.logoRightPath}
              onChange={(e) => config.updateField('logoRightPath', e.target.value)}
              className="flex-1 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
              placeholder="Path to right logo image"
            />
          </div>
          <div className="flex items-center gap-2 ml-5">
            <label className="text-[10px] font-bold text-app-text-muted uppercase w-28">Banner landscape</label>
            <input type="text" value={config.bannerLandscapePath}
              onChange={(e) => config.updateField('bannerLandscapePath', e.target.value)}
              className="flex-1 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
              placeholder="Path to landscape banner image"
            />
          </div>
        </div>
      </div>

      {/* Margins */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">
          Margins (US / CT / MR)
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-app-text-muted uppercase w-48">Top margin for header/logo</label>
            <input type="number" min={0} max={999} value={config.marginTop}
              onChange={(e) => config.updateField('marginTop', parseInt(e.target.value) || 0)}
              className="w-20 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
            />
            <span className="text-[9px] text-app-text-muted">(0.1 inch = 140)</span>
          </div>
          <div className="text-[10px] font-bold text-app-text-muted uppercase mt-2 mb-1">Image Area Margins</div>
          <div className="grid grid-cols-2 gap-2 ml-2">
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-app-text-muted w-12">Left</label>
              <input type="number" min={0} max={999} value={config.marginLeft}
                onChange={(e) => config.updateField('marginLeft', parseInt(e.target.value) || 0)}
                className="w-20 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-app-text-muted w-12">Right</label>
              <input type="number" min={0} max={999} value={config.marginRight}
                onChange={(e) => config.updateField('marginRight', parseInt(e.target.value) || 0)}
                className="w-20 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-app-text-muted w-12">Top</label>
              <input type="number" min={0} max={999} value={config.marginImageTop}
                onChange={(e) => config.updateField('marginImageTop', parseInt(e.target.value) || 0)}
                className="w-20 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-app-text-muted w-12">Bottom</label>
              <input type="number" min={0} max={999} value={config.marginImageBottom}
                onChange={(e) => config.updateField('marginImageBottom', parseInt(e.target.value) || 0)}
                className="w-20 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckboxRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-app-text cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-app-accent" />
      {label}
    </label>
  );
}

function RadioRow({ label, checked, onChange, name }: { label: string; checked: boolean; onChange: () => void; name: string }) {
  return (
    <label className="flex items-center gap-2 text-xs text-app-text cursor-pointer">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="accent-app-accent" />
      {label}
    </label>
  );
}
