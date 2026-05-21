// CONTACT PAGE
const ContactPage = () => {
  const [sent, setSent] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", email: "", hospital: "", machines: "1-5", msg: "" });
  const onSubmit = (e) => { e.preventDefault(); setSent(true); };

  return (
    <div className="page-in">
      <PageHeader
        eyebrow="Contact"
        title={<>Talk to the team <span className="italic text-grad-rose">behind Mediview.</span></>}
        sub="Demos, enterprise quotes, partnership, support — we reply within one business day."
      />

      <Section>
        <div className="grid lg:grid-cols-5 gap-10">
          <FadeUp className="lg:col-span-2">
            <div className="space-y-4">
              {[
                { i: <I.Mail size={18}/>, t: "Email", v: "prashamk15@gmail.com", h: "mailto:prashamk15@gmail.com" },
                { i: <I.Phone size={18}/>, t: "Phone", v: "+91 91363 35529", h: "tel:+919136335529" },
                { i: <I.MapPin size={18}/>, t: "HQ", v: "Mumbai · India", h: "https://maps.google.com/?q=Mumbai" },
                { i: <I.MessageCircle size={18}/>, t: "Sales chat", v: "Live · Mon–Sat 10:00–19:00 IST", h: "mailto:prashamk15@gmail.com" },
              ].map(c => (
                <a key={c.t} href={c.h} className="lift flex items-center gap-4 rounded-2xl border border-[var(--line)] bg-white dark:bg-white/[0.03] p-5">
                  <div className="h-11 w-11 grid place-items-center rounded-xl bg-rose-soft dark:bg-rose/15 text-rose">{c.i}</div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-[var(--muted)]">{c.t}</div>
                    <div className="font-semibold">{c.v}</div>
                  </div>
                </a>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-rose/30 bg-gradient-to-br from-rose-soft to-white dark:from-rose/10 dark:to-white/[0.02] p-6">
              <div className="font-display font-bold text-lg">Hospital pilot program</div>
              <p className="mt-2 text-sm text-[var(--muted)]">Free 60-day evaluation for chains with 5+ workstations. Includes onboarding + AI training on your study set.</p>
              <div className="mt-4"><Btn href="mailto:prashamk15@gmail.com?subject=Hospital%20pilot%20program%20application" variant="primary" size="sm" icon={<I.ArrowRight size={14}/>}>Apply for pilot</Btn></div>
            </div>
          </FadeUp>

          <FadeUp delay={0.15} className="lg:col-span-3">
            <form onSubmit={onSubmit} className="rounded-3xl border border-[var(--line)] bg-white dark:bg-white/[0.03] p-7 md:p-9">
              {sent ? (
                <div className="py-12 text-center">
                  <div className="mx-auto h-14 w-14 rounded-full grid place-items-center bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"><I.Check size={26}/></div>
                  <h3 className="mt-5 font-display font-bold text-2xl">Got it. We'll be in touch.</h3>
                  <p className="mt-2 text-[var(--muted)]">Expect a reply within one business day.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Your name" v={form.name} onChange={v => setForm({...form, name: v})} placeholder="Dr. Rohan Patel" />
                  <Field label="Email" type="email" v={form.email} onChange={v => setForm({...form, email: v})} placeholder="rohan@apex.in" />
                  <Field label="Hospital / Clinic" v={form.hospital} onChange={v => setForm({...form, hospital: v})} placeholder="Apex Diagnostics" />
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.16em] font-bold text-[var(--muted)]">Workstations needed</label>
                    <select value={form.machines} onChange={e => setForm({...form, machines: e.target.value})} className="mt-2 w-full h-11 rounded-xl border border-[var(--line)] bg-paper2/40 dark:bg-white/[0.04] px-3 font-medium">
                      <option>1-5</option><option>5-15</option><option>15-50</option><option>50+</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[11px] uppercase tracking-[0.16em] font-bold text-[var(--muted)]">How can we help?</label>
                    <textarea required rows={5} value={form.msg} onChange={e => setForm({...form, msg: e.target.value})} placeholder="Tell us about your setup, pain points, scan volume…" className="mt-2 w-full rounded-xl border border-[var(--line)] bg-paper2/40 dark:bg-white/[0.04] p-3 font-medium resize-none focus:border-rose focus:outline-none transition-colors"/>
                  </div>
                  <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="text-xs text-[var(--muted)]">No spam. We never share your email.</div>
                    <Btn as="button" type="submit" variant="primary" size="lg" icon={<I.Send size={16}/>} magnetic>Send message</Btn>
                  </div>
                </div>
              )}
            </form>
          </FadeUp>
        </div>
      </Section>
    </div>
  );
};

const Field = ({ label, v, onChange, type = "text", placeholder }) => (
  <div>
    <label className="text-[11px] uppercase tracking-[0.16em] font-bold text-[var(--muted)]">{label}</label>
    <input
      required
      type={type}
      value={v}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="mt-2 w-full h-11 rounded-xl border border-[var(--line)] bg-paper2/40 dark:bg-white/[0.04] px-3 font-medium focus:border-rose focus:outline-none transition-colors"
    />
  </div>
);

window.ContactPage = ContactPage;
