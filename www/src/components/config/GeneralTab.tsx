import { useHospitalConfigStore } from '@/stores/hospitalConfigStore';

export function GeneralTab() {
  const config = useHospitalConfigStore();

  return (
    <div className="space-y-5">
      {/* Hospital Information */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">
          Hospital Information
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Hospital Name" value={config.hospitalName} onChange={(v) => config.updateField('hospitalName', v)} />
          <FormField label="Secondary Name" value={config.brandNameSecondary} onChange={(v) => config.updateField('brandNameSecondary', v)} />
          <FormField label="Services (pipe separated)" value={config.servicesList} onChange={(v) => config.updateField('servicesList', v)} />
          <FormSelect
            label="Timezone"
            value={config.timezone}
            onChange={(v) => config.updateField('timezone', v)}
            options={[
              { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
              { value: 'America/New_York', label: 'America/New_York (EST)' },
              { value: 'Europe/London', label: 'Europe/London (GMT)' },
              { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
            ]}
          />
          <FormField label="Registration No." value={config.registration} onChange={(v) => config.updateField('registration', v)} />
          <FormField label="Website" value={config.website} onChange={(v) => config.updateField('website', v)} />
        </div>
      </div>

      {/* Address */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">
          Hospital Address
        </h3>
        <div className="space-y-2">
          <FormField label="Address Line 1" value={config.address1} onChange={(v) => config.updateField('address1', v)} />
          <FormField label="Address Line 2" value={config.address2} onChange={(v) => config.updateField('address2', v)} />
          <FormField label="Address Line 3" value={config.address3} onChange={(v) => config.updateField('address3', v)} />
          <div className="grid grid-cols-3 gap-3">
            <FormField label="City" value={config.city} onChange={(v) => config.updateField('city', v)} />
            <FormField label="State" value={config.state} onChange={(v) => config.updateField('state', v)} />
            <FormField label="PIN Code" value={config.pincode} onChange={(v) => config.updateField('pincode', v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Phone" value={config.phone} onChange={(v) => config.updateField('phone', v)} />
            <FormField label="Email" value={config.email} onChange={(v) => config.updateField('email', v)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-app-text-secondary mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
      />
    </div>
  );
}

function FormSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-app-text-secondary mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
