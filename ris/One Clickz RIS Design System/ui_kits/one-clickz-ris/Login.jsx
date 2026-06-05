/* Login screen. Mirrors ris/ui/src/LoginGate.tsx, restyled.
   Centered card on white, red wordmark, role demo picker. */
const { useState: useStateLogin } = React;

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useStateLogin('admin@oneclickz.health');
  const [password, setPassword] = useStateLogin('••••••••');
  const [role, setRole] = useStateLogin('admin');
  const [busy, setBusy] = useStateLogin(false);

  const submit = (e) => {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => { setBusy(false); onLogin(role); }, 450);
  };

  const roles = [
    { value: 'admin', label: 'Admin' },
    { value: 'doctor', label: 'Doctor' },
    { value: 'receptionist', label: 'Receptionist' },
  ];

  return (
    <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--app-bg)', padding:24 }}>
      <div style={{ width:'100%', maxWidth:760, display:'grid', gridTemplateColumns:'1fr 1fr', border:'1px solid var(--app-border)', borderRadius:'var(--radius-lg)', overflow:'hidden', boxShadow:'var(--shadow-md)' }}>
        {/* Left brand rail */}
        <div style={{ background:'var(--app-surface)', borderRight:'1px solid var(--app-border)', padding:'34px 30px', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:24, fontWeight:600, color:'var(--app-accent)', letterSpacing:'-.01em' }}>One Clickz RIS</div>
            <div style={{ fontSize:13, color:'var(--app-text-muted)', marginTop:4 }}>Radiology Information System</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:13, marginTop:30 }}>
            {[['scan-line','Connects to the One Clickz DICOM Viewer'],['network','DICOM modality worklist & LAN setup'],['shield-check','DICOM transfer to consoles on the LAN']].map(([ic,t]) => (
              <div key={t} style={{ display:'flex', gap:11, alignItems:'center', fontSize:13, color:'var(--app-text-secondary)' }}>
                <span style={{ color:'var(--app-accent)', display:'flex' }}><Icon name={ic} size={17} /></span>{t}
              </div>
            ))}
          </div>
          <div style={{ fontSize:11, color:'var(--app-text-muted)', marginTop:30 }}>v1.0.0 · part of the One Clickz ecosystem</div>
        </div>
        {/* Right form */}
        <form onSubmit={submit} style={{ background:'#fff', padding:'34px 30px', display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:600 }}>Sign in</div>
            <div style={{ fontSize:12, color:'var(--app-text-muted)', marginTop:2 }}>Use your clinic credentials to continue.</div>
          </div>
          <Input label="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Password" required type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Select label="Sign in as (demo role)" value={role} options={roles} onChange={(e) => setRole(e.target.value)} hint="Switches which areas you can see in this prototype." />
          <Button variant="primary" size="lg" className="btn-block" type="submit" icon="log-in" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          <div style={{ fontSize:11, color:'var(--app-text-muted)', textAlign:'center' }}>Authenticated against <span className="mono">/api/auth/login.php</span></div>
        </form>
      </div>
    </div>
  );
}
window.LoginScreen = LoginScreen;
