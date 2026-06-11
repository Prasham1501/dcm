import { useEffect, useState } from 'react';
import { FolderSearch, Save } from 'lucide-react';
import { Banner, Button, SectionHeader, TextInput, TextareaInput } from '@/components/RisUi';
import { apiAnalyzerGraphs, apiSaveAnalyzerGraphs, type AnalyzerGraphSettings } from '../api/settingsApi';

const EMPTY: AnalyzerGraphSettings = { analyzer_graph_source_dirs: '', analyzer_graph_extensions: 'png,jpg,jpeg,pdf,bmp' };

export function AnalyzerGraphsCard() {
  const [settings, setSettings] = useState<AnalyzerGraphSettings>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiAnalyzerGraphs().then(setSettings).catch((e) => setError(e?.message || 'Failed to load'));
  }, []);

  const save = async () => {
    setBusy(true); setError(null); setMessage(null);
    try { setSettings(await apiSaveAnalyzerGraphs(settings)); setMessage('Saved'); }
    catch (e: any) { setError(e?.message || 'Save failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="card card-pad mt-5">
      <SectionHeader icon={FolderSearch} title="Machine graphs / images" sub="Folders where your analyzers export graphs (chromatograms, histograms) or report images. RIS attaches matching files to the patient and prints them on the report." />
      {error && <Banner kind="warning">{error}</Banner>}
      {message && <div className="banner banner-success mt-3">{message}</div>}
      <TextareaInput
        label="Source folders (one per line)"
        rows={4}
        className="mt-3"
        value={settings.analyzer_graph_source_dirs}
        onChange={(e) => setSettings({ ...settings, analyzer_graph_source_dirs: e.target.value })}
        placeholder={'C:\\Mindray\\Export\n\\\\REPORTING-PC\\AnalyzerGraphs'}
      />
      <div className="grid-2 mt-3">
        <TextInput
          label="Allowed file types"
          value={settings.analyzer_graph_extensions}
          onChange={(e) => setSettings({ ...settings, analyzer_graph_extensions: e.target.value })}
          hint="Comma separated, e.g. png,jpg,jpeg,pdf,bmp"
        />
        <div className="banner banner-info" style={{ margin: 0 }}>
          Files are matched to a visit by Reg No, accession, MRN, or patient name in the filename. In Result Entry, click <b>Fetch machine graphs</b> to pull them in.
        </div>
      </div>
      <Button variant="primary" icon={Save} disabled={busy} onClick={save} className="mt-4">Save graph folders</Button>
    </div>
  );
}
