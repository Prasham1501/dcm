import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '@/stores/uiStore';
import { GeneralTab } from '@/components/config/GeneralTab';
import { ServerTab } from '@/components/config/ServerTab';
import { SendTab } from '@/components/config/SendTab';
import { ClinicalTab } from '@/components/config/ClinicalTab';
import { ServiceTab } from '@/components/config/ServiceTab';
import { NetworkReceiverTab } from '@/components/config/NetworkReceiverTab';
import { PrintSettingsTab } from '@/components/config/PrintSettingsTab';

const TABS = ['General', 'Print', 'Server', 'Send', 'Clinical', 'Service', 'Network'] as const;
type TabName = typeof TABS[number];

export function ConfigPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabName>('General');

  const renderTab = () => {
    switch (activeTab) {
      case 'General': return <GeneralTab />;
      case 'Print': return <PrintSettingsTab />;
      case 'Server': return <ServerTab />;
      case 'Send': return <SendTab />;
      case 'Clinical': return <ClinicalTab />;
      case 'Service': return <ServiceTab />;
      case 'Network': return <NetworkReceiverTab />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-app-bg border-2 border-app-accent rounded-lg shadow-2xl w-[800px] max-h-[600px] flex flex-col">
        {/* Tab header */}
        <div className="flex items-center border-b-2 border-app-accent">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors border-r border-app-border last:border-r-0 ${
                activeTab === tab
                  ? 'bg-app-accent text-white'
                  : 'bg-app-header-bg text-app-text hover:bg-app-hover'
              }`}
            >
              {tab}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => navigate(-1)}
            className="px-3 py-2.5 text-app-text-muted hover:text-app-text hover:bg-app-hover text-lg font-bold"
          >
            ×
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto p-5">
          {renderTab()}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-app-border">
          <button
            onClick={() => {
              useUIStore.getState().addToast('Settings saved successfully', 'success', 2000);
            }}
            className="px-4 py-1.5 text-xs font-semibold border-2 border-green-600 text-green-600 bg-app-bg rounded hover:bg-green-600 hover:text-white transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}
