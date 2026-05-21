// Login + signup pages — minimal, branded.

const AuthShell = ({ children, title, sub }) => (
  <div className="min-h-screen flex">
    {/* Left — brand panel */}
    <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-rose via-rose-dark to-ink text-white p-12 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 -right-32 h-96 w-96 rounded-full bg-amber-400/40 blur-3xl"/>
        <div className="absolute bottom-10 left-10 h-80 w-80 rounded-full bg-teal/30 blur-3xl"/>
      </div>
      <div className="relative flex flex-col justify-between w-full max-w-lg">
        <a href="#/" className="inline-flex items-center gap-2 text-2xl font-display font-bold">
          <div className="h-9 w-9 rounded-xl bg-white text-rose grid place-items-center font-bold">M</div>
          Mediview
        </a>
        <div>
          <div className="font-display text-5xl xl:text-6xl font-bold leading-[1.05] mb-6">See more.<br/>Diagnose faster.<br/>Bill accurately.</div>
          <p className="text-white/85 text-lg max-w-md leading-relaxed">A workstation built by radiologists, for radiologists. One installer. Zero subscriptions to printers.</p>
          <div className="mt-12 flex items-center gap-6 text-sm text-white/80">
            <div><div className="font-display font-bold text-2xl text-white">200+</div>hospitals</div>
            <div><div className="font-display font-bold text-2xl text-white">2.4M</div>studies/year</div>
            <div><div className="font-display font-bold text-2xl text-white">99.9%</div>uptime</div>
          </div>
        </div>
        <div className="text-xs text-white/60">© Mediview · ISO 13485 · DICOM compliant</div>
      </div>
    </div>

    {/* Right — form */}
    <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-paper dark:bg-midnight">
      <div className="w-full max-w-md">
        <a href="#/" className="lg:hidden inline-flex items-center gap-2 text-xl font-display font-bold mb-8">
          <div className="h-8 w-8 rounded-lg bg-rose text-white grid place-items-center font-bold">M</div> Mediview
        </a>
        <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="mt-2 text-[var(--muted)]">{sub}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </div>
  </div>
);

const TextField = ({ label, type = "text", value, onChange, placeholder, autoComplete, required }) => (
  <label className="block">
    <span className="text-sm font-semibold">{label}</span>
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} autoComplete={autoComplete} required={required}
      className="mt-1.5 w-full h-11 px-4 rounded-xl border border-[var(--line)] bg-white dark:bg-white/[0.04] text-ink dark:text-paper focus:outline-none focus:ring-2 focus:ring-rose/40 focus:border-rose transition"
    />
  </label>
);

const GoogleButton = ({ onClick, label = "Continue with Google" }) => (
  <button onClick={onClick} className="w-full h-11 rounded-xl border border-[var(--line)] bg-white dark:bg-white/[0.04] hover:bg-paper2 dark:hover:bg-white/[0.07] flex items-center justify-center gap-3 font-semibold text-sm transition">
    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
    {label}
  </button>
);

const LoginPage = () => {
  const { login, google, loading, error, setError } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      const u = await login({ email, password });
      // super_admin's home is the operator console — never the user dashboard.
      window.location.hash = (u?.role === 'super_admin') ? '#/dashboard/admin' : '#/dashboard';
    }
    catch {}
  };
  const demoGoogle = async () => {
    try {
      const u = await google({ id_token: 'mock', email: 'doctor@hospital.in', name: 'Dr. Priya Sharma' });
      window.location.hash = (u?.role === 'super_admin') ? '#/dashboard/admin' : '#/dashboard';
    }
    catch {}
  };

  return (
    <AuthShell title="Welcome back." sub="Sign in to your Mediview dashboard.">
      {error && <div className="mb-4 p-3 rounded-lg bg-rose-soft text-rose-dark text-sm border border-rose/30">{error}</div>}

      <GoogleButton onClick={demoGoogle} />

      <div className="my-6 flex items-center gap-3 text-xs text-[var(--muted)]">
        <div className="h-px flex-1 bg-[var(--line)]"/> OR <div className="h-px flex-1 bg-[var(--line)]"/>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <TextField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@hospital.in" autoComplete="email" required/>
        <TextField label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="current-password" required/>
        <div className="flex justify-end text-sm">
          <a href="#/dashboard/forgot" className="text-rose hover:underline font-semibold">Forgot password?</a>
        </div>
        <button type="submit" disabled={loading} className="w-full h-11 rounded-xl bg-rose text-white font-semibold hover:bg-rose-dark transition disabled:opacity-60 flex items-center justify-center gap-2">
          {loading && <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>}
          Sign in
        </button>
      </form>

      <p className="mt-6 text-sm text-[var(--muted)]">
        New to Mediview? <a href="#/dashboard/signup" className="text-rose font-semibold hover:underline">Create an account</a>
      </p>

    </AuthShell>
  );
};

const SignupPage = () => {
  const { signup, google, loading, error } = useAuth();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [role, setRole] = React.useState('radiologist');

  const submit = async (e) => {
    e.preventDefault();
    try {
      const u = await signup({ name, email, password, role });
      window.location.hash = (u?.role === 'super_admin') ? '#/dashboard/admin' : '#/dashboard';
    } catch {}
  };
  const demoGoogle = async () => {
    try {
      const u = await google({ id_token: 'mock', email: 'doctor@hospital.in', name: 'Dr. Priya Sharma' });
      window.location.hash = (u?.role === 'super_admin') ? '#/dashboard/admin' : '#/dashboard';
    }
    catch {}
  };

  return (
    <AuthShell title="Get started." sub="Free forever for measurements & reporting.">
      {error && <div className="mb-4 p-3 rounded-lg bg-rose-soft text-rose-dark text-sm border border-rose/30">{error}</div>}

      <GoogleButton onClick={demoGoogle} label="Sign up with Google" />

      <div className="my-6 flex items-center gap-3 text-xs text-[var(--muted)]">
        <div className="h-px flex-1 bg-[var(--line)]"/> OR <div className="h-px flex-1 bg-[var(--line)]"/>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <TextField label="Full name" value={name} onChange={setName} placeholder="Dr. Priya Sharma" required/>
        <TextField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@hospital.in" autoComplete="email" required/>
        <TextField label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" autoComplete="new-password" required/>

        <label className="block">
          <span className="text-sm font-semibold">I am a…</span>
          <select value={role} onChange={e => setRole(e.target.value)} className="mt-1.5 w-full h-11 px-4 rounded-xl border border-[var(--line)] bg-white dark:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-rose/40">
            <option value="radiologist">Solo radiologist</option>
            <option value="clinic_owner">Clinic owner</option>
            <option value="hospital_admin">Hospital admin</option>
          </select>
        </label>

        <button type="submit" disabled={loading} className="w-full h-11 rounded-xl bg-rose text-white font-semibold hover:bg-rose-dark transition disabled:opacity-60 flex items-center justify-center gap-2">
          {loading && <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>}
          Create account
        </button>
        <p className="text-xs text-[var(--muted)] text-center">By signing up you agree to our <a href="#/terms" className="underline">Terms</a> and <a href="#/privacy" className="underline">Privacy Policy</a>.</p>
      </form>

      <p className="mt-6 text-sm text-[var(--muted)]">
        Already have an account? <a href="#/dashboard/login" className="text-rose font-semibold hover:underline">Sign in</a>
      </p>
    </AuthShell>
  );
};

const ForgotPage = () => {
  const [email, setEmail] = React.useState('');
  const [sent, setSent] = React.useState(false);

  const submit = (e) => {
    e.preventDefault(); setSent(true);
    // Live mode: POST /auth/forgot — sends a reset link via email.
  };

  return (
    <AuthShell title="Reset password" sub="We'll email you a reset link.">
      {sent ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 p-5 text-sm">
          <div className="font-semibold text-emerald-700 dark:text-emerald-300 mb-1">Check your inbox.</div>
          <div className="text-emerald-800/80 dark:text-emerald-200/80">If an account exists for <span className="font-mono">{email}</span> we've sent a reset link. It expires in 1 hour.</div>
          <a href="#/dashboard/login" className="mt-4 inline-block text-rose font-semibold hover:underline">← Back to sign in</a>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <TextField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@hospital.in" required/>
          <button type="submit" className="w-full h-11 rounded-xl bg-rose text-white font-semibold hover:bg-rose-dark transition">Send reset link</button>
          <a href="#/dashboard/login" className="block text-center text-sm text-[var(--muted)] hover:text-rose">← Back to sign in</a>
        </form>
      )}
    </AuthShell>
  );
};

window.LoginPage = LoginPage;
window.SignupPage = SignupPage;
window.ForgotPage = ForgotPage;
