/**
 * Volume3DButton — CT-gated "3D" button shown in the viewer toolbars.
 *
 * Drops in next to the Print / Form F buttons. Disables itself (with a
 * descriptive tooltip) when the study is non-CT, has too few slices, or
 * the GPU lacks WebGL2.
 */
import { Box } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { openVolume3D } from './openVolume3D';
import {
  checkVolume3DEligibility,
  describeIneligibility,
  isWebGL2Supported,
} from './lib/eligibility';

export interface Volume3DButtonProps {
  patientName?: string;
  patientId?: string;
  studyDate?: string;
  studyDescription?: string;
  modality?: string;
  filePaths: string[];
  compact?: boolean;
  className?: string;
}

export function Volume3DButton(props: Volume3DButtonProps) {
  const navigate = useNavigate();
  const eligibility = checkVolume3DEligibility({
    modality: props.modality,
    imageCount: props.filePaths.length,
    webgl2Supported: isWebGL2Supported(),
  });

  // Hide the button entirely for non-CT/MR — keeps the toolbar uncluttered
  // for US/CR studies where 3D never applies. Show the disabled state only
  // when the modality is right but something else (slice count, GPU) blocks.
  if (eligibility.reason === 'wrong_modality' || eligibility.reason === 'missing_data') {
    return null;
  }

  const disabled = !eligibility.eligible;
  const title = disabled ? describeIneligibility(eligibility.reason) : 'Open 3D Volume Viewer';

  const base = props.compact
    ? 'flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border-2 rounded transition-colors'
    : 'flex items-center gap-1 2xl:gap-1.5 px-2.5 2xl:px-3.5 py-1 2xl:py-1.5 text-xs 2xl:text-sm font-semibold border-2 rounded transition-colors';

  const stateClasses = disabled
    ? 'border-app-border text-app-text-muted bg-app-bg opacity-50 cursor-not-allowed'
    : 'border-app-accent text-app-accent bg-app-bg hover:bg-app-accent hover:text-white';

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        openVolume3D({
          patientName: props.patientName,
          patientId: props.patientId,
          studyDate: props.studyDate,
          studyDescription: props.studyDescription,
          modality: props.modality,
          filePaths: props.filePaths,
        }, (path: string) => navigate(path));
      }}
      className={props.className ?? `${base} ${stateClasses}`}
    >
      <Box className="w-3.5 h-3.5 2xl:w-4.5 2xl:h-4.5" />
      3D
    </button>
  );
}
