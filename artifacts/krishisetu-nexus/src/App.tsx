import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode, CSSProperties } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Route, Switch, Link, Redirect, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { ClerkProvider, Show, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, BadgeCheck, Bell, BookOpen, Boxes,
  BriefcaseBusiness, Camera, Check, CheckCircle2, ChevronDown, ChevronRight,
  ClipboardCheck, Cloud, CloudRain, Compass, Droplets, FileText, Fingerprint, Flower2,
  ImagePlus, Leaf, MapPin, Menu, ScanLine, Search, Shield, ShieldAlert,
  ShoppingBag, ShoppingCart, Sprout, Sun, ThermometerSun, Users, Wind,
} from 'lucide-react';
import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey, useProcessIntake,
  useGetDiagnosis, getGetDiagnosisQueryKey, useListProducts, getListProductsQueryKey,
  useVerifyProductBatch, useCheckoutOrder, useGetSprayWindow, getGetSprayWindowQueryKey,
  useListFieldTasks, getListFieldTasksQueryKey, useCompleteFieldTask,
  useListEscalations, getListEscalationsQueryKey, useReviewEscalation,
  useListServices, getListServicesQueryKey,
} from '@workspace/api-client-react';
import type { IntakeInput, EscalationReviewInput } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient();
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY.');
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#173D2E',
    colorForeground: '#23352D',
    colorMutedForeground: '#67766D',
    colorDanger: '#B44435',
    colorBackground: '#FFFDF8',
    colorInput: '#FFFFFF',
    colorInputForeground: '#23352D',
    colorNeutral: '#D9DED5',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '14px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffdf8] border border-[#e5e4da] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-semibold text-[#173d2e]',
    headerSubtitle: 'text-[#596b60]',
    socialButtonsBlockButtonText: 'font-medium text-[#23352d]',
    formFieldLabel: 'font-medium text-[#23352d]',
    footerActionLink: 'font-semibold text-[#173d2e]',
    footerActionText: 'text-[#596b60]',
    dividerText: 'text-[#68766d]',
    identityPreviewEditButton: 'font-medium text-[#173d2e]',
    formFieldSuccessText: 'text-[#286b47]',
    alertText: 'text-[#87392e]',
    logoBox: 'max-h-10',
    logoImage: 'max-h-10 w-auto',
    socialButtonsBlockButton: 'border border-[#d9ded5] bg-white',
    formButtonPrimary: 'bg-[#173d2e] hover:bg-[#24583f] text-white',
    formFieldInput: 'border-[#d9ded5] bg-white text-[#23352d]',
    footerAction: 'border-t border-[#e5e4da]',
    dividerLine: 'bg-[#d9ded5]',
    alert: 'border-[#e7b7a8] bg-[#fff5f2]',
    otpCodeFieldInput: 'border-[#d9ded5] bg-white text-[#23352d]',
    formFieldRow: 'gap-2',
    main: 'gap-4',
  },
};
const navSections = [
  { label: 'FIELD DESK', items: [
    ['Dashboard', '/dashboard', Compass], ['Ask an agronomist', '/ask', Camera],
    ['Field tasks', '/tasks', ClipboardCheck], ['Weather & spray', '/weather', Cloud],
    ['Irrigation', '/irrigation', Droplets],
  ] },
  { label: 'FARM SUPPORT', items: [
    ['Marketplace', '/marketplace', ShoppingBag], ['Services', '/services', BriefcaseBusiness],
    ['Soil reports', '/soil-reports', FileText], ['Mandi prices', '/mandi-prices', ArrowDownRight],
    ['Government schemes', '/schemes', BookOpen],
  ] },
  { label: 'COMMUNITY', items: [
    ['Pest map', '/pest-map', MapPin], ['Orders & bookings', '/orders-bookings', Boxes],
    ['FPO dashboard', '/fpo-dashboard', Users],
  ] },
  { label: 'OPERATIONS', items: [
    ['Seller workspace', '/seller-dashboard', BriefcaseBusiness], ['Admin console', '/admin', Shield],
    ['Escalations', '/escalations', ShieldAlert], ['Privacy audit', '/privacy-audit', Fingerprint],
  ] },
];

type IconType = typeof Compass;
function Button({ children, onClick, kind = 'primary', disabled = false, className = '', type = 'button' }: {
  children: ReactNode; onClick?: () => void; kind?: 'primary' | 'outline' | 'quiet' | 'warm';
  disabled?: boolean; className?: string; type?: 'button' | 'submit';
}) {
  return <button type={type} disabled={disabled} onClick={onClick} className={`button button-${kind} ${className}`} data-testid="button-action">{children}</button>;
}
function PageHeading({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{kicker}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
function StateCard({ kind, title, detail, retry }: { kind: 'loading' | 'error' | 'empty'; title: string; detail: string; retry?: () => void }) {
  return <div className={`state-card state-${kind}`} data-testid={`state-${kind}`}>
    {kind === 'loading' ? <div className="skeleton-stack"><i/><i/><i/></div> : kind === 'error' ? <ShieldAlert size={22}/> : <Sprout size={22}/>}
    <div><strong>{title}</strong><p>{detail}</p>{kind === 'error' && retry && <button className="text-link" onClick={retry}>Try again</button>}</div>
  </div>;
}
function Pill({ children, tone = 'green' }: { children: React.ReactNode; tone?: 'green' | 'amber' | 'red' | 'neutral' }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeLabel = (navSections.flatMap(s => s.items).find(i => i[1] === location)?.[0] as string | undefined) ?? 'Farm workspace';
  const { user } = useUser();
  const { signOut } = useClerk();
  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Your farm account';
  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('') || 'KS';
  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <Link href="/dashboard" className="brand-lockup"><span className="brand-mark"><Sprout size={21}/></span><span><b>KrishiSetu</b><small>NEXUS · FIELD DESK</small></span></Link>
      <div className="field-profile"><div className="profile-monogram">{initials}</div><div><strong>{displayName}</strong><span>Signed-in account</span></div><ChevronDown size={15}/></div>
      <nav aria-label="Main navigation">{navSections.map(section => <div className="nav-section" key={section.label}>
        <div className="nav-label">{section.label}</div>{section.items.map(([label, href, Icon]) => {
          const I = Icon as IconType;
          return <Link key={href as string} href={href as string} onClick={() => setMobileOpen(false)} className={`nav-item ${location === href ? 'nav-active' : ''}`} data-testid={`link-${String(label).toLowerCase().replaceAll(' ', '-')}`}><I size={17}/><span>{label as string}</span>{href === '/tasks' && <span className="nav-count">3</span>}</Link>;
        })}
      </div>)}</nav>
      <div className="sidebar-bottom"><div className="sync-card"><div className="sync-icon"><Activity size={15}/></div><div><strong>Ready for the field</strong><span>Work can continue offline</span></div><span className="sync-dot"/></div>
        <Link className="privacy-link" href="/privacy-audit"><Shield size={14}/> Your data stays yours</Link>
        <div className="sidebar-foot">KRISHISETU NEXUS <span>v1.0 · DEMO DISTRICT</span></div></div>
    </aside>
    {mobileOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)}/>}
    <main className="main-column">
      <header className="topbar"><button className="mobile-menu" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={21}/></button><div className="breadcrumb"><span>FIELD DESK</span><ChevronRight size={13}/><b>{activeLabel}</b></div><div className="topbar-right"><div className="connection-chip"><span/> DEMO DISTRICT · SAMPLE DATA</div><Link className="icon-button" href="/tasks" aria-label="View tasks"><Bell size={18}/><i/></Link><button className="top-avatar" type="button" aria-label="Sign out" title="Sign out" onClick={() => signOut({ redirectUrl: basePath || '/' })}>{initials}</button></div></header>
      <div className="page-content">{children}<footer className="page-footer"><span>KrishiSetu Nexus</span><span>Practical advice. Safer decisions. Stronger farms.</span><Link href="/privacy-audit">Privacy & data controls</Link></footer></div>
    </main>
  </div>;
}

function Welcome() {
  const [, setLocation] = useLocation();
  const [language, setLanguage] = useState('English');
  return <div className="welcome-screen"><div className="welcome-nav"><Link href="/" className="brand-lockup"><span className="brand-mark"><Sprout size={21}/></span><span><b>KrishiSetu</b><small>NEXUS · FIELD DESK</small></span></Link><span className="offline-note"><span/>Built for the field, even offline</span></div>
    <section className="welcome-content"><div className="welcome-copy"><div className="eyebrow"><span className="eyebrow-line"/> A clearer way forward, from the field</div><h1>Good decisions<br/>grow <em>good seasons.</em></h1><p className="welcome-lead">Bring your crop questions, field work and trusted local support together — in one place made for the realities of farming.</p>
      <div className="welcome-points"><div><span><Camera size={17}/></span><b>Ask with a photo</b><small>Get careful, explainable guidance</small></div><div><span><ShieldCheckIcon/></span><b>Know what is safe</b><small>People review when it matters</small></div><div><span><Cloud size={17}/></span><b>Keep moving offline</b><small>Your next steps stay close</small></div></div>
    </div><div className="welcome-card"><div className="card-index">01 / GET STARTED</div><div className="welcome-card-icon"><Sprout size={23}/></div><h2>Let’s make this<br/>feel like yours.</h2><p>Choose the language you’re most comfortable working in.</p><label className="field-label" htmlFor="welcome-language">YOUR LANGUAGE</label><div className="select-wrap"><select id="welcome-language" value={language} onChange={e => setLanguage(e.target.value)} data-testid="select-language">{['English','हिन्दी · Hindi','తెలుగు · Telugu','தமிழ் · Tamil','मराठी · Marathi','ಕನ್ನಡ · Kannada','বাংলা · Bengali'].map(l => <option key={l}>{l}</option>)}</select><ChevronDown size={16}/></div><Button className="wide-button" onClick={() => { localStorage.setItem('ks-language', language); setLocation('/auth/login'); }}>Continue <ArrowRight size={17}/></Button><div className="welcome-safe"><Shield size={14}/> Your farm details are private by default.</div></div></section>
    <div className="welcome-bottom"><span>LOCAL KNOWLEDGE, CONNECTED CARE</span><span>Built for smallholder farms · Telangana demo district</span></div>
  </div>;
}
function ShieldCheckIcon() { return <Shield size={17}/>; }
function Login() {
  return <Redirect to="/sign-in" />;
}

function SignInPage() {
  return <div className="welcome-screen">
    <div className="welcome-nav"><Link href="/" className="brand-lockup"><span className="brand-mark"><Sprout size={21}/></span><span><b>KrishiSetu</b><small>NEXUS · FIELD DESK</small></span></Link><Link className="back-link" href="/">← Back to overview</Link></div>
    <main className="auth-signin-wrap">
      <div className="eyebrow"><span className="eyebrow-line"/> YOUR FIELD DESK</div>
      <h1>Welcome back<br/><em>to your farm.</em></h1>
      <p className="welcome-lead">Sign in or create a farmer account to save crop observations, tasks and orders.</p>
      <div className="auth-clerk-card">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} forceRedirectUrl={`${basePath}/dashboard`} />
      </div>
      <p className="auth-role-note">Agronomist, seller, FPO and administrator access is assigned by a district administrator.</p>
    </main>
  </div>;
}

function SignUpPage() {
  return <div className="welcome-screen">
    <div className="welcome-nav"><Link href="/" className="brand-lockup"><span className="brand-mark"><Sprout size={21}/></span><span><b>KrishiSetu</b><small>NEXUS · FIELD DESK</small></span></Link><Link className="back-link" href="/">← Back to overview</Link></div>
    <main className="auth-signin-wrap">
      <div className="eyebrow"><span className="eyebrow-line"/> FARMER ACCOUNT</div>
      <h1>Start with a<br/><em>safer next step.</em></h1>
      <p className="welcome-lead">Create an account to keep your field notes and follow-ups together.</p>
      <div className="auth-clerk-card">
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} forceRedirectUrl={`${basePath}/dashboard`} />
      </div>
      <p className="auth-role-note">This signup creates a farmer account. Other roles are granted by a district administrator.</p>
    </main>
  </div>;
}

function Dashboard() {
  const q = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const data = q.data;
  return <><PageHeading kicker="FIELD SUMMARY · DEMO DISTRICT" title="Your farm, at a glance." description="A sample view of what needs attention today." action={<Link href="/ask" className="button button-primary"><Camera size={16}/> Ask about a crop</Link>}/>
    {q.isLoading ? <StateCard kind="loading" title="Gathering your farm details" detail="Connecting to the district farm record…"/> : q.isError ? <StateCard kind="error" title="Farm summary unavailable" detail="We couldn't load your latest farm information. Your other field tools are still available." retry={() => q.refetch()}/> : !data ? <StateCard kind="empty" title="No farm record yet" detail="Your farm summary will appear here once a district record is available."/> : <>
      <section className="hero-farm"><div className="farm-hero-main"><div className="farm-location"><MapPin size={14}/> NALGONDA DISTRICT <span>·</span> TELANGANA</div><h2>{data.farmName}</h2><p>{data.cropName} <span>·</span> {data.cropStage}</p><div className="farm-stats"><div><b>{data.acres}</b><span>ACRES IN CULTIVATION</span></div><div><b>{data.openCases}</b><span>OPEN CROP CASES</span></div><div><b>{data.tasksDue}</b><span>TASKS TO COMPLETE</span></div></div></div><div className="hero-field-art"><div className="sun-orb"/><div className="field-lines"><i/><i/><i/><i/><i/></div><span className="field-label-art">YOUR FIELDS · NALGONDA</span><span className="field-coordinate">16°53' N&nbsp; 79°14' E</span></div></section>
      <div className="dashboard-grid"><section className="panel today-panel"><div className="panel-top"><div><div className="eyebrow">TODAY’S SIGNAL</div><h3>What the field is telling us</h3></div><CloudRain size={21}/></div><div className="weather-advisory">{data.weatherAdvisory}</div><div className="panel-link-row"><span><Sun size={16}/> Check the 24-hour spray window</span><Link href="/weather" aria-label="View spray window"><ArrowRight size={17}/></Link></div></section>
        <section className="panel market-panel"><div className="eyebrow">LOCAL MARKET WATCH · SAMPLE</div><h3>Indicative mandi price</h3><div className="price-line"><span>₹</span>{Number(data.mandiPrice).toLocaleString('en-IN')}<small>/ quintal</small></div><div className="price-context"><ArrowDownRight size={15}/> Nalgonda · demo listing, not a live rate</div><Link className="inline-link" href="/mandi-prices">Explore local prices <ArrowRight size={15}/></Link></section></div>
      <section className="next-steps"><div className="eyebrow">A GOOD NEXT STEP</div><div className="next-step-row"><span className="next-step-icon"><Camera size={19}/></span><div><h3>Something look different in the field?</h3><p>Share what you’re seeing. We’ll help you think through what to do next.</p></div><Link href="/ask" className="button button-primary">Start a crop question <ArrowRight size={15}/></Link></div></section>
      <section className="panel activity-panel"><div className="panel-top"><div><div className="eyebrow">RECENT FIELD NOTES</div><h3>Recent activity</h3></div><Activity size={19}/></div>{!data.recentActivity?.length ? <div className="empty-inline">Your recent field activity will appear here.</div> : <div className="activity-list">{data.recentActivity.map((item, i) => <div className="activity-row" key={item.id}><span className={`activity-marker activity-${i%3}`}/><div><strong>{item.label}</strong><p>{item.detail}</p></div><span className="activity-status">{item.status}</span><small>{new Date(item.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</small></div>)}</div>}</section>
    </>}</>;
}

function Intake() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { user } = useUser();
  const mutation = useProcessIntake();
  const [cropName, setCropName] = useState('Cotton');
  const [cropStage, setCropStage] = useState<IntakeInput['cropStage']>('vegetative');
  const [symptoms, setSymptoms] = useState('');
  const [acres, setAcres] = useState('2.5');
  const [language, setLanguage] = useState<IntakeInput['language']>('en');
  const [photo, setPhoto] = useState('');
  const [consent, setConsent] = useState(false);
  const [formError, setFormError] = useState('');
  const choosePhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image processing is unavailable.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      setPhoto(canvas.toDataURL('image/jpeg', 0.86));
      setFormError('');
    } catch {
      setFormError('This image could not be prepared. Try a JPG, PNG or WebP photo.');
    } finally {
      bitmap?.close();
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault(); setFormError('');
    if (symptoms.trim().length < 5) { setFormError('Add a few details about what you’re noticing (at least 5 characters).'); return; }
    if (!consent) { setFormError('Please confirm consent before your observation is analysed.'); return; }
    mutation.mutate({data:{cropName,cropStage,symptoms: symptoms.trim(),acres:Number(acres),language,imageDataUrl:photo||undefined,consentToAnalyze:true}}, {
      onSuccess: result => { localStorage.setItem(`ks-recent-diagnosis:${user?.id ?? 'unknown'}`, result.diagnosis.id); qc.invalidateQueries({queryKey:getGetDashboardSummaryQueryKey()}); setLocation(`/diagnosis/${result.diagnosis.id}`); },
    });
  };
  return <><PageHeading kicker="CROP SUPPORT · STEP 1 OF 2" title="Show us what you’re seeing." description="A clear photo and a few field details help us make a more useful, careful assessment."/>
    <form className="intake-layout" onSubmit={submit}><div className="intake-main panel"><div className="form-section-head"><span className="step-number">01</span><div><h3>Tell us about the crop</h3><p>Start with the field where you noticed a change.</p></div></div>
      <div className="form-grid"><label className="form-field"><span>Crop</span><select value={cropName} onChange={e=>setCropName(e.target.value)} data-testid="select-crop">{['Cotton','Paddy','Maize','Chilli','Turmeric','Groundnut','Other'].map(x=><option key={x}>{x}</option>)}</select></label><label className="form-field"><span>Growth stage</span><select value={cropStage} onChange={e=>setCropStage(e.target.value as IntakeInput['cropStage'])} data-testid="select-crop-stage">{[['sowing','Sowing'],['vegetative','Vegetative'],['flowering','Flowering'],['fruiting','Fruiting'],['harvesting','Harvesting']].map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label><label className="form-field"><span>Area affected</span><div className="input-suffix"><input type="number" min="0.1" step="0.1" value={acres} onChange={e=>setAcres(e.target.value)} data-testid="input-acres"/><i>acres</i></div></label><label className="form-field"><span>Response language</span><select value={language} onChange={e=>setLanguage(e.target.value as IntakeInput['language'])} data-testid="select-response-language">{[['en','English'],['hi','हिन्दी'],['te','తెలుగు'],['ta','தமிழ்'],['mr','मराठी'],['kn','ಕನ್ನಡ'],['bn','বাংলা']].map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label></div>
      <div className="form-section-head second-head"><span className="step-number">02</span><div><h3>Describe the change</h3><p>When did it begin? Which part of the plant is affected?</p></div></div><label className="form-field"><span>What have you noticed?</span><textarea value={symptoms} onChange={e=>setSymptoms(e.target.value)} placeholder="For example: small pale spots appeared on the lower leaves three days ago. I have not seen insects." rows={5} data-testid="input-symptoms"/></label>
      <div className="form-section-head second-head"><span className="step-number">03</span><div><h3>Add a field photo <small>OPTIONAL</small></h3><p>A close view and a wider view can help show context.</p></div></div>
      <label className={`photo-drop ${photo?'photo-added':''}`}>{photo ? <><img src={photo} alt="Selected field observation"/><span className="photo-replace">Photo attached · choose another to replace</span><input type="file" accept="image/*" capture="environment" onChange={choosePhoto}/></> : <><ImagePlus size={23}/><strong>Take a photo or choose from your device</strong><small>Images are included only with your consent · JPG, PNG</small><input type="file" accept="image/*" capture="environment" onChange={choosePhoto}/></>}</label>
      <label className="consent-check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I agree to have this observation reviewed to provide crop guidance. My photo and field details are not used for unrelated purposes.</span></label>
      {formError && <div className="form-error" role="alert">{formError}</div>}{mutation.isError&&<div className="form-error" role="alert">Your observation could not be sent. Check your connection and try again.</div>}
      <div className="form-actions"><span><Shield size={15}/> Advice is not a substitute for an officer’s review.</span><Button type="submit" disabled={mutation.isPending||!consent}>{mutation.isPending?'Sending observation…':<>Send for assessment <ArrowRight size={16}/></>}</Button></div>
    </div><aside className="intake-aside"><div className="aside-note"><div className="aside-note-mark"><ShieldCheckIcon/></div><h3>Careful by design.</h3><p>We’ll explain what the evidence supports, what remains uncertain, and when a local agronomist should review.</p><div className="aside-divider"/><span><Check size={15}/> No guesswork disguised as certainty</span><span><Check size={15}/> Extra care around chemical decisions</span><span><Check size={15}/> Your information remains yours</span></div><div className="aside-tip"><span>FIELD TIP</span><p>Photograph both the whole plant and a close-up of the affected area in natural light.</p></div></aside></form>
  </>;
}

function DiagnosisPage() {
  const {diagnosisId=''} = useParams<{diagnosisId:string}>();
  const q=useGetDiagnosis(diagnosisId,{query:{queryKey:getGetDiagnosisQueryKey(diagnosisId),enabled:!!diagnosisId}});
  const d=q.data;
  return <><PageHeading kicker="CROP SUPPORT · ASSESSMENT" title="A careful read of the signs." description="Evidence first. Clear uncertainty. A safer next step." action={<Link className="button button-outline" href="/ask"><Camera size={15}/> New observation</Link>}/>
    {q.isLoading?<StateCard kind="loading" title="Reviewing the case record" detail="Loading the evidence and assessment…"/>:q.isError?<StateCard kind="error" title="Assessment not available" detail="We couldn’t load this case. Please check the case link or try again." retry={()=>q.refetch()}/>:!d?<StateCard kind="empty" title="No assessment found" detail="This case may have expired or the link may be incomplete."/>:<>
      {(d.requiresOfficerReview||d.confidence<0.7||d.severity.toLowerCase()==='severe'||d.category.toLowerCase().includes('chemical'))&&<div className="review-banner"><ShieldAlert size={20}/><div><strong>Hold off on treatment — officer review is needed.</strong><p>{d.requiresOfficerReview?'This case has been referred to a local agronomist.':'The assessment has low confidence, severe symptoms or a chemical-related concern.'} Do not apply a pesticide based on this preliminary assessment.</p></div><Pill tone="amber">REVIEW REQUIRED</Pill></div>}
      <section className="diagnosis-summary panel"><div><div className="eyebrow">PRELIMINARY ASSESSMENT · {d.category}</div><h2>{d.condition}</h2><p>Observed on {d.cropName}</p><div className="diag-badges"><Pill tone={d.severity.toLowerCase()==='severe'?'red':'amber'}>{d.severity} severity</Pill><Pill tone="neutral">{Math.round(d.confidence*100)}% confidence</Pill></div></div><div className="confidence-dial"><div style={{'--confidence':`${Math.max(0,Math.min(100,d.confidence*100))}%`} as CSSProperties}><b>{Math.round(d.confidence*100)}%</b></div><span>CONFIDENCE</span></div></section>
      <div className="diagnosis-columns"><section className="panel"><div className="eyebrow">WHY THIS IS SUGGESTED</div><h3>Evidence we can point to</h3>{d.evidence?.length?<ul className="evidence-list">{d.evidence.map((x,i)=><li key={i}><span><Check size={14}/></span>{x}</li>)}</ul>:<p className="muted-copy">No supporting evidence has been recorded yet.</p>}</section><section className="panel"><div className="eyebrow">OTHER POSSIBILITIES</div><h3>What else could explain it?</h3>{d.differentials?.length?<div className="differential-list">{d.differentials.map((x,i)=><div key={i}><span>{x.condition}</span><b>{Math.round(x.probability*100)}%</b><i><em style={{width:`${Math.max(0,Math.min(100,x.probability*100))}%`}}/></i></div>)}</div>:<p className="muted-copy">No differentials provided for this observation.</p>}</section></div>
      <section className="panel observation-panel"><div className="eyebrow">BEFORE YOU DECIDE</div><h3>Observations that could help</h3>{d.suggestedObservations?.length?<div className="observation-chips">{d.suggestedObservations.map((x,i)=><span key={i}><Search size={14}/>{x}</span>)}</div>:<p className="muted-copy">Keep a note of any new changes in the field.</p>}<div className="provenance"><span><Activity size={15}/> Assessment source</span><p>{d.provenance}</p></div></section>
      <div className="safety-note"><Shield size={18}/><div><strong>Safety before action</strong><p>{d.safetyNote}</p></div></div>
      <div className="diag-actions"><Link className="button button-outline" href="/ask"><ArrowLeft size={15}/> Back to field desk</Link>{!d.requiresOfficerReview&&d.confidence>=.7&&d.severity.toLowerCase()!=='severe'&&!d.category.toLowerCase().includes('chemical')?<Link className="button button-primary" href={`/treatments/${d.id}`}>Explore safe next steps <ArrowRight size={15}/></Link>:<Link className="button button-warm" href="/escalations"><ShieldAlert size={15}/> See review status <ArrowRight size={15}/></Link>}</div>
    </>}</>;
}

function TreatmentsPage() {
  const {diagnosisId=''}=useParams<{diagnosisId:string}>();
  const diagnosis=useGetDiagnosis(diagnosisId,{query:{queryKey:getGetDiagnosisQueryKey(diagnosisId),enabled:!!diagnosisId}});
  const products=useListProducts({crop:diagnosis.data?.cropName,problem:diagnosis.data?.condition},{query:{queryKey:getListProductsQueryKey({crop:diagnosis.data?.cropName,problem:diagnosis.data?.condition}),enabled:!!diagnosis.data}});
  const d=diagnosis.data; const catalog=products.data;
  const blocked=!!d&&(d.requiresOfficerReview||d.confidence<.7||d.severity.toLowerCase()==='severe'||d.category.toLowerCase().includes('chemical'));
  return <><PageHeading kicker="SAFE NEXT STEPS" title="Choose with care." description="Options are screened against your case and the local product record." action={<Link href={`/diagnosis/${diagnosisId}`} className="button button-outline"><ArrowLeft size={15}/> Return to assessment</Link>}/>
    {diagnosis.isLoading?<StateCard kind="loading" title="Checking the case" detail="Reading crop and safety details…"/>:diagnosis.isError||!d?<StateCard kind="error" title="Case details unavailable" detail="We need the original case record before showing treatment options." retry={()=>diagnosis.refetch()}/>:blocked?<div className="review-banner"><ShieldAlert size={20}/><div><strong>No chemical products are available for this case.</strong><p>Low-confidence, severe, chemical-related and officer-review cases must be assessed by an agronomist first. Keep observing and contact your local extension officer.</p><Link className="inline-link" href="/escalations">Go to review cases <ArrowRight size={14}/></Link></div></div>:products.isLoading?<StateCard kind="loading" title="Checking safe product options" detail="Confirming compatibility and batch records…"/>:products.isError?<StateCard kind="error" title="Product safety check unavailable" detail="No products can be shown until the safety catalogue responds." retry={()=>products.refetch()}/>:!catalog?.products?.length?<StateCard kind="empty" title="No compatible products listed" detail="No verified and compatible products are currently available for this case. Ask a local agronomist before choosing a treatment."/>:<div className="product-list">{catalog.products.map(p=><article className="product-row panel" key={p.id}><div className="product-stamp"><Leaf size={21}/></div><div className="product-info"><div className="product-category">{p.category} · {p.activeIngredient}</div><h3>{p.name}</h3><p>Seller: {p.seller} {p.sellerVerified&&<BadgeCheck size={14}/>}</p><div className="product-tags"><Pill>{p.compatibilityScore}% crop match</Pill><Pill tone={p.batch.verified&&!p.batch.recalled?'green':'red'}>{p.batch.verified&&!p.batch.recalled?'Batch verified':'Not cleared'}</Pill><span>Harvest interval: {p.harvestIntervalDays} days</span></div></div><div className="product-buy"><b>₹{Number(p.priceInr).toLocaleString('en-IN')}</b><small>Batch {p.batch.batchNumber} · Expires {p.batch.expiryDate}</small>{p.batch.verified&&!p.batch.recalled&&p.stock>0?<Link className="button button-primary" href={`/marketplace/product/${p.id}`}>View safe listing <ArrowRight size={14}/></Link>:<span className="unavailable">Unavailable for purchase</span>}</div></article>)}</div>}
  </>;
}

function WeatherPage() {
 const q=useGetSprayWindow({district:'Nalgonda'},{query:{queryKey:getGetSprayWindowQueryKey({district:'Nalgonda'})}});
 const matrix=q.data;
 return <><PageHeading kicker="WEATHER · NALGONDA DISTRICT" title="Wait for the right window." description="A 24-hour view of conditions that affect spray drift, coverage and wash-off."/>
 {q.isLoading?<StateCard kind="loading" title="Loading local conditions" detail="Building your hourly spray window…"/>:q.isError?<StateCard kind="error" title="Weather advice unavailable" detail="Please check your connection before planning a spray." retry={()=>q.refetch()}/>:!matrix?<StateCard kind="empty" title="No hourly forecast available" detail="There is no spray suitability data for this district right now."/>:<>
 <div className="weather-callout"><div className="weather-callout-icon"><CloudRain size={22}/></div><div><span>LOCAL ADVISORY · {matrix.district}</span><p>{matrix.advisory}</p></div><Pill tone="amber">CHECK BEFORE APPLYING</Pill></div>
 <section className="panel forecast-panel"><div className="panel-top"><div><div className="eyebrow">NEXT 24 HOURS</div><h3>Spray suitability by hour</h3></div><div className="legend"><span className="legend-good"/> Good <span className="legend-caution"/> Caution <span className="legend-avoid"/> Avoid</div></div>
 <div className="hour-grid">{matrix.hours?.map((h,i)=><div className={`hour-card hour-${h.status}`} key={`${h.hour}-${i}`}><b>{h.hour}</b><div className="hour-icon">{h.status==='good'?<Sun size={17}/>:h.status==='caution'?<Cloud size={17}/>:<CloudRain size={17}/>}</div><span className="hour-status">{h.status}</span><div className="hour-data"><span><Wind size={12}/>{h.windKph} km/h</span><span><Droplets size={12}/>{h.rainChance}% rain</span><span><ThermometerSun size={12}/>{h.temperatureC}°</span></div></div>)}</div></section>
 <div className="weather-footnote"><Shield size={16}/><p>Weather suitability is a guide, not permission to spray. Follow product label directions and local agronomist advice. Avoid spraying in high winds, rain or heat.</p></div>
 </>}</>;
}

function TasksPage() {
 const qc=useQueryClient(); const q=useListFieldTasks({query:{queryKey:getListFieldTasksQueryKey()}});
  const {user}=useUser(); const offlineKey=`ks-offline-completed:${user?.id??'unknown'}`;
 const complete=useCompleteFieldTask(); const [doneMessage,setDoneMessage]=useState('');
  const [localCompleted,setLocalCompleted]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem(offlineKey)||'[]') as string[]}catch{return []}});
 const tasks=q.data;
  const finish=(id:string,offline:boolean)=>{if(offline){const next=[...new Set([...localCompleted,id])];setLocalCompleted(next);localStorage.setItem(offlineKey,JSON.stringify(next));setDoneMessage('Saved on this device. It will be sent when your connection returns.');return;}complete.mutate({taskId:id,data:{completed:true,offlineCreated:false}},{onSuccess:()=>{setDoneMessage('Task marked complete.');qc.invalidateQueries({queryKey:getListFieldTasksQueryKey()});},onError:()=>setDoneMessage('Could not save completion. Keep this task open and try again.')});};
  const syncOffline=async()=>{if(!navigator.onLine||!localCompleted.length)return;try{for(const taskId of localCompleted)await complete.mutateAsync({taskId,data:{completed:true,offlineCreated:true}});setLocalCompleted([]);localStorage.removeItem(offlineKey);setDoneMessage('Saved task updates are now synced.');qc.invalidateQueries({queryKey:getListFieldTasksQueryKey()});}catch{setDoneMessage('Some updates could not sync. Your saved list is still on this device.');}};
  useEffect(()=>{const handleOnline=()=>{if(localCompleted.length)void syncOffline();};window.addEventListener('online',handleOnline);return()=>window.removeEventListener('online',handleOnline);},[localCompleted]);
 return <><PageHeading kicker="FIELD DESK · DAILY WORK" title="Small steps, done well." description="Your assigned field actions, in one place." action={<Pill tone="amber">{tasks?.filter(t=>!t.completed).length??'—'} OPEN</Pill>}/>
 {q.isLoading?<StateCard kind="loading" title="Loading your field tasks" detail="Checking the latest assignment list…"/>:q.isError?<StateCard kind="error" title="Tasks unavailable" detail="We couldn’t reach your field task list." retry={()=>q.refetch()}/>:!tasks?.length?<StateCard kind="empty" title="No tasks assigned" detail="New field actions will appear here when they’re assigned to you."/>:<><div className="task-list">{tasks.map((task,i)=>{const completed=task.completed||localCompleted.includes(task.id);return <article className={`task-row panel ${completed?'task-complete':''}`} key={task.id}><div className={`task-check ${completed?'checked':''}`}>{completed?<Check size={16}/>:<span>{String(i+1).padStart(2,'0')}</span>}</div><div className="task-body"><div className="task-meta">{task.type} <span>·</span> Due {new Date(task.dueDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} {(task.offlineCreated||localCompleted.includes(task.id))&&<Pill tone="amber">SAVED OFFLINE</Pill>}</div><h3>{task.title}</h3><p>{task.description}</p>{task.diagnosisId&&<Link className="inline-link" href={`/diagnosis/${task.diagnosisId}`}>View related case <ArrowRight size={13}/></Link>}<Link className="inline-link" href={`/verification/${task.id}`}>Add a field verification <ArrowRight size={13}/></Link></div>{completed?<Pill>COMPLETE</Pill>:<Button kind="outline" disabled={complete.isPending} onClick={()=>finish(task.id,!navigator.onLine)}>Mark complete <Check size={15}/></Button>}</article>})}</div>{doneMessage&&<div className="notice-line" role="status">{doneMessage}</div>}<div className="offline-help"><Cloud size={18}/><div><strong>No signal? Keep moving.</strong><p>Completions saved here stay on this device until you sync them.</p></div>{localCompleted.length>0&&<Button kind="outline" disabled={!navigator.onLine||complete.isPending} onClick={syncOffline}>Sync {localCompleted.length} saved task{localCompleted.length===1?'':'s'}</Button>}</div></>}
 </>;
}

function EscalationsPage() {
 const qc=useQueryClient(); const q=useListEscalations({query:{queryKey:getListEscalationsQueryKey()}});
 const review=useReviewEscalation(); const [notes,setNotes]=useState<Record<string,string>>({}); const [decisions,setDecisions]=useState<Record<string,EscalationReviewInput['decision']>>({}); const [feedback,setFeedback]=useState('');
 const submit=(id:string)=>{const note=notes[id]?.trim()||'';if(note.length<3){setFeedback('Please add a review note with at least 3 characters.');return;}review.mutate({escalationId:id,data:{decision:decisions[id]||'approved',notes:note}},{onSuccess:()=>{setFeedback('Review recorded.');qc.invalidateQueries({queryKey:getListEscalationsQueryKey()});},onError:()=>setFeedback('Review could not be saved. Please try again.')});};
 return <><PageHeading kicker="AGRONOMIST DESK · HUMAN REVIEW" title="Cases that need a person." description="Review uncertainty, document your reasoning, and guide a safer next step."/>
 {q.isLoading?<StateCard kind="loading" title="Loading review queue" detail="Checking cases awaiting an agronomist…"/>:q.isError?<StateCard kind="error" title="Review queue unavailable" detail="We couldn’t load the escalation list." retry={()=>q.refetch()}/>:!q.data?.length?<StateCard kind="empty" title="No cases awaiting review" detail="Cases needing human attention will be listed here."/>:<div className="escalation-list">{q.data.map(item=><article className="panel escalation-card" key={item.id}><div className="escalation-head"><div><div className="eyebrow">CASE {item.id} · {new Date(item.createdAt).toLocaleDateString('en-IN')}</div><h3>{item.condition}</h3><p>{item.cropName} · {item.reason}</p></div><Pill tone={item.severity.toLowerCase()==='severe'?'red':'amber'}>{item.status}</Pill></div><div className="escalation-signals"><span><b>{Math.round(item.confidence*100)}%</b> confidence</span><span><b>{item.severity}</b> severity</span><Link className="inline-link" href={`/diagnosis/${item.diagnosisId}`}>Open diagnosis <ArrowRight size={14}/></Link></div>{item.officerNotes&&<div className="prior-note"><strong>Previous note</strong><p>{item.officerNotes}</p></div>}<div className="review-controls"><label className="form-field"><span>Decision</span><select value={decisions[item.id]||'approved'} onChange={e=>setDecisions({...decisions,[item.id]:e.target.value as EscalationReviewInput['decision']})}><option value="approved">Approve guidance</option><option value="modified">Modify recommendation</option><option value="rejected">Reject assessment</option></select></label><label className="form-field review-notes"><span>Officer notes</span><textarea rows={2} placeholder="Document the reasoning and next steps for the farmer…" value={notes[item.id]||''} onChange={e=>setNotes({...notes,[item.id]:e.target.value})}/></label><Button disabled={review.isPending} onClick={()=>submit(item.id)}>Record review <Check size={15}/></Button></div></article>)}</div>}
 {feedback&&<div className="notice-line" role="status">{feedback}</div>}
 </>;
}

function ServicesPage() {
 const q=useListServices({query:{queryKey:getListServicesQueryKey()}});
 return <><PageHeading kicker="LOCAL SUPPORT · VERIFIED PROVIDERS" title="A little help, close to home." description="Find trusted services and practical support around your fields."/>
 {q.isLoading?<StateCard kind="loading" title="Finding district services" detail="Loading verified local providers…"/>:q.isError?<StateCard kind="error" title="Services unavailable" detail="Please reconnect and try loading the local directory again." retry={()=>q.refetch()}/>:!q.data?.length?<StateCard kind="empty" title="No providers listed yet" detail="Verified local services will appear here as the district directory is updated."/>:<div className="service-grid">{q.data.map(s=><article className="panel service-card" key={s.id}><div className="service-icon"><BriefcaseBusiness size={20}/></div><div className="service-top"><Pill tone={s.verified?'green':'amber'}>{s.verified?'VERIFIED':'CHECK PROVIDER'}</Pill><span>{s.availability}</span></div><div className="eyebrow">{s.category}</div><h3>{s.name}</h3><p>{s.description}</p><div className="service-bottom"><b>₹{Number(s.rateInr).toLocaleString('en-IN')}<small> / {s.unit}</small></b><Button kind="outline" disabled>Booking unavailable <ArrowRight size={14}/></Button></div></article>)}</div>}
 </>;
}

function Marketplace() {
 const q=useListProducts(undefined,{query:{queryKey:getListProductsQueryKey()}});
 const products=q.data?.products||[];
 return <><PageHeading kicker="MARKETPLACE · SAFER FARM INPUTS" title="Buy only what you can trust." description="Products are shown with seller, compatibility and batch details up front." action={<Link href="/marketplace/authenticity-scanner" className="button button-outline"><ScanLine size={16}/> Check a batch</Link>}/>
  {q.isLoading?<StateCard kind="loading" title="Checking verified listings" detail="Loading current products and batch information…"/>:q.isError?<StateCard kind="error" title="Marketplace unavailable" detail="We can’t confirm product safety while the catalogue is offline." retry={()=>q.refetch()}/>:!products.length?<StateCard kind="empty" title="No products cleared for listing" detail="Only currently safe, available products can be purchased. Check back when the verified catalogue is updated."/>:<><div className="market-notice"><ShieldCheckIcon/><p>Demo catalogue: listings show sample seller and batch records. Recalled or unverified batches cannot be purchased.</p></div><div className="market-products">{products.map(p=><article className="market-product panel" key={p.id}><div className="product-art"><div className="product-sun"/><Leaf size={31}/><span>{p.category}</span></div><div className="market-product-copy"><div className="product-category">{p.category.toUpperCase()} · {p.activeIngredient}</div><h3>{p.name}</h3><p className="seller-line">{p.seller} {p.sellerVerified&&<BadgeCheck size={14}/>}</p><div className="market-checks"><Pill tone={p.batch.verified&&!p.batch.recalled?'green':'red'}>{p.batch.recalled?'Recalled':p.batch.verified?'Batch verified':'Unverified'}</Pill><span>{Math.round(p.compatibilityScore*100)}% sample compatibility</span></div><div className="market-product-bottom"><b>₹{Number(p.priceInr).toLocaleString('en-IN')}</b>{p.batch.verified&&!p.batch.recalled&&p.stock>0?<Link className="button button-primary" href={`/marketplace/product/${p.id}`}>View details <ArrowRight size={14}/></Link>:<span className="unavailable">Not available to buy</span>}</div></div></article>)}</div></>}
 <div className="market-links"><Link href="/marketplace/authenticity-scanner"><ScanLine size={16}/> Verify a QR or batch code <ArrowRight size={15}/></Link><Link href="/marketplace/cart-checkout"><ShoppingCart size={16}/> Review your basket <ArrowRight size={15}/></Link></div>
 </>;
}

function ProductDetail() {
 const {id=''}=useParams<{id:string}>();
  const {user}=useUser(); const cartKey=`ks-cart:${user?.id??'unknown'}`;
 const q=useListProducts(undefined,{query:{queryKey:getListProductsQueryKey()}});
 const item=q.data?.products?.find(p=>p.id===id);
 const [quantity,setQuantity]=useState(1); const [,setLocation]=useLocation();
  const add=()=>{if(!item||!item.batch.verified||item.batch.recalled)return;const cart=JSON.parse(localStorage.getItem(cartKey)||'[]') as {productId:string;batchId:string;quantity:number}[];const existing=cart.find(x=>x.productId===item.id&&x.batchId===item.batch.id);if(existing)existing.quantity+=quantity;else cart.push({productId:item.id,batchId:item.batch.id,quantity});localStorage.setItem(cartKey,JSON.stringify(cart));setLocation('/marketplace/cart-checkout');};
 return <><PageHeading kicker="MARKETPLACE · PRODUCT DETAILS" title="Check the label. Check the batch." description="A listing is only useful when you can see what you’re buying." action={<Link href="/marketplace" className="button button-outline"><ArrowLeft size={15}/> All products</Link>}/>{q.isLoading?<StateCard kind="loading" title="Loading product details" detail="Checking current batch and seller status…"/>:q.isError?<StateCard kind="error" title="Product details unavailable" detail="Could not verify this listing." retry={()=>q.refetch()}/>:!item?<StateCard kind="empty" title="Product not found" detail="This listing may have expired or been removed."/>:<div className="product-detail-layout"><section className="panel product-detail-main"><div className="detail-art"><div className="product-sun"/><Flower2 size={70}/><span>SELLER LISTING · {item.category.toUpperCase()}</span></div><div className="detail-product-copy"><div className="eyebrow">{item.category} · {item.activeIngredient}</div><h2>{item.name}</h2><p className="seller-line">{item.seller} {item.sellerVerified&&<><BadgeCheck size={15}/> Verified seller</>}</p><div className="detail-tags"><Pill tone={item.batch.verified&&!item.batch.recalled?'green':'red'}>{item.batch.recalled?'Recalled batch':item.batch.verified?'Verified batch':'Batch not verified'}</Pill><Pill>{item.compatibilityScore}% crop compatibility</Pill></div><h3>Safety label guidance</h3><ul className="safety-list">{item.safetyInstructions?.map((s,i)=><li key={i}><Shield size={14}/>{s}</li>)}</ul><div className="label-data"><span>Batch <b>{item.batch.batchNumber}</b></span><span>Expiry <b>{item.batch.expiryDate}</b></span><span>Harvest interval <b>{item.harvestIntervalDays} days</b></span><span>Compatible crops <b>{item.compatibleCrops?.join(', ')}</b></span></div></div></section><aside className="panel purchase-panel"><div className="eyebrow">LISTING PRICE</div><div className="detail-price">₹{Number(item.priceInr).toLocaleString('en-IN')}</div><div className="stock-status"><span/> {item.stock} units listed</div><label className="form-field"><span>Quantity</span><input type="number" min="1" max={item.stock} value={quantity} onChange={e=>setQuantity(Math.max(1,Math.min(item.stock,Number(e.target.value))))}/></label>{item.batch.verified&&!item.batch.recalled&&item.stock>0?<Button className="wide-button" onClick={add}><ShoppingCart size={16}/> Add to basket</Button>:<div className="blocked-purchase"><ShieldAlert size={16}/> This batch is not cleared for purchase.</div>}<Link className="scanner-link" href="/marketplace/authenticity-scanner"><ScanLine size={15}/> Independently verify this batch</Link><p className="purchase-disclaimer">Always read and follow the product label. Check local agronomist advice before use.</p></aside></div>}</>;
}

function ScannerPage() {
 const verify=useVerifyProductBatch(); const [payload,setPayload]=useState(''); const [feedback,setFeedback]=useState('');
 const submit=(e:FormEvent)=>{e.preventDefault();setFeedback('');if(!payload.trim()){setFeedback('Enter a QR payload or batch code to check.');return;}verify.mutate({data:{qrPayload:payload.trim()}},{onError:()=>setFeedback('Could not verify this code. Check it and try again.')});};
 const r=verify.data;
 return <><PageHeading kicker="MARKETPLACE · AUTHENTICITY" title="Check before you open it." description="Verify the product batch and seller against the current district record." action={<Link href="/marketplace" className="button button-outline"><ArrowLeft size={15}/> Marketplace</Link>}/><div className="scanner-layout"><div className="scanner-card panel"><div className="scanner-icon"><ScanLine size={27}/></div><h3>Enter the QR payload</h3><p>Scan a product code with your phone camera, or enter its printed batch code here.</p><form onSubmit={submit}><label className="form-field"><span>QR payload or batch code</span><input value={payload} onChange={e=>setPayload(e.target.value)} placeholder="e.g. batch code or QR text" data-testid="input-qr-payload"/></label>{feedback&&<div className="form-error">{feedback}</div>}<Button type="submit" disabled={verify.isPending} className="wide-button">{verify.isPending?'Checking record…':<><ScanLine size={16}/> Verify product batch</>}</Button></form>{r&&<div className={`verification-result ${r.authentic?'verified':'not-verified'}`} role="status"><div className="verification-result-icon">{r.authentic?<BadgeCheck size={22}/>:<ShieldAlert size={22}/>}</div><div><strong>{r.authentic?'Batch record matched':'Do not use this product'}</strong><p>{r.message}</p><div className="verified-details"><span>Product <b>{r.productName}</b></span><span>Batch <b>{r.batchNumber}</b></span><span>Expiry <b>{r.expiryDate}</b></span><span>Seller <b>{r.sellerVerified?'Verified':'Not verified'}</b></span></div></div></div>}</div><aside className="scanner-aside"><div className="aside-note"><ShieldCheckIcon/><h3>What a match means</h3><p>The batch details match a record in the district catalogue. Still read the label and check the expiry date before use.</p></div><div className="aside-tip"><span>NO MATCH?</span><p>Do not buy or use a product you can’t verify. Ask the seller or contact your local agriculture office.</p></div></aside></div></>;
}

function CheckoutPage() {
 const qc=useQueryClient();
  const {user}=useUser(); const cartKey=`ks-cart:${user?.id??'unknown'}`; const recentDiagnosisKey=`ks-recent-diagnosis:${user?.id??'unknown'}`;
 const q=useListProducts(undefined,{query:{queryKey:getListProductsQueryKey()}});
  const checkout=useCheckoutOrder(); const [district,setDistrict]=useState('Nalgonda'); const [pincode,setPincode]=useState('508001'); const [diagnosisId,setDiagnosisId]=useState(()=>localStorage.getItem(recentDiagnosisKey)||''); const [consent,setConsent]=useState(false); const [receipt,setReceipt]=useState<typeof checkout.data>(undefined);
  const cart=useMemo(()=>JSON.parse(localStorage.getItem(cartKey)||'[]') as {productId:string;batchId:string;quantity:number}[],[cartKey]);
 const items=(q.data?.products||[]).filter(p=>cart.some(c=>c.productId===p.id&&c.batchId===p.batch.id)&&p.batch.verified&&!p.batch.recalled);
 const total=items.reduce((n,p)=>n+p.priceInr*(cart.find(c=>c.productId===p.id)?.quantity||1),0);
 const place=(e:FormEvent)=>{e.preventDefault();if(!consent||!diagnosisId.trim())return;const safeItems=items.flatMap(p=>{const ci=cart.find(c=>c.productId===p.id&&c.batchId===p.batch.id);return ci?[{productId:p.id,batchId:p.batch.id,quantity:ci.quantity}]:[]});if(!safeItems.length)return;checkout.mutate({data:{items:safeItems,consentToPurchase:true,diagnosisId:diagnosisId.trim(),shippingDistrict:district,pincode,fpoDiscount:false}},{onSuccess:r=>{setReceipt(r);localStorage.removeItem(cartKey);qc.invalidateQueries({queryKey:getListFieldTasksQueryKey()});},onError:()=>setReceipt(undefined)});};
 return <><PageHeading kicker="MARKETPLACE · DEMO CHECKOUT" title="Review your order." description="This demo saves an order request only; it does not collect payment or arrange delivery." action={<Link href="/marketplace" className="button button-outline"><ArrowLeft size={15}/> Continue shopping</Link>}/>{q.isLoading?<StateCard kind="loading" title="Rechecking your basket" detail="Confirming batch records before checkout…"/>:q.isError?<StateCard kind="error" title="Unable to recheck products" detail="Checkout is paused until product safety can be verified." retry={()=>q.refetch()}/>:receipt?<div className="receipt-card panel"><div className="receipt-check"><Check size={23}/></div><div className="eyebrow">DEMO ORDER SAVED · {receipt.id}</div><h2>Your order request is in the queue.</h2><p>No payment was collected and fulfillment is not connected. Follow-up task {receipt.followUpTaskId} has been recorded.</p><div className="receipt-total">₹{Number(receipt.totalInr).toLocaleString('en-IN')} <small>sample total incl. ₹{Number(receipt.deliveryInr).toLocaleString('en-IN')} delivery</small></div><Link href="/orders-bookings" className="button button-primary">View orders <ArrowRight size={15}/></Link></div>:!items.length?<StateCard kind="empty" title="Your basket is empty" detail="Add a currently verified product batch from the marketplace to continue."/>:<form className="checkout-grid" onSubmit={place}><section className="panel checkout-items"><div className="eyebrow">YOUR BASKET · {items.length} LISTING{items.length===1?'':'S'}</div>{items.map(p=><div className="checkout-item" key={p.id}><div className="product-stamp"><Leaf size={20}/></div><div><strong>{p.name}</strong><span>Batch {p.batch.batchNumber} · Sample record</span><span>Quantity: {cart.find(c=>c.productId===p.id)?.quantity||1}</span></div><b>₹{Number(p.priceInr*(cart.find(c=>c.productId===p.id)?.quantity||1)).toLocaleString('en-IN')}</b></div>)}<div className="checkout-subtotal"><span>Sample subtotal</span><b>₹{total.toLocaleString('en-IN')}</b></div><label className="consent-check checkout-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I have reviewed the sample listing, batch, label guidance and consent to this demo order request.</span></label></section><aside className="panel checkout-address"><div className="eyebrow">DELIVERY & CASE</div><label className="form-field"><span>Shipping district</span><input value={district} onChange={e=>setDistrict(e.target.value)}/></label><label className="form-field"><span>PIN code</span><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={pincode} onChange={e=>setPincode(e.target.value)}/></label><label className="form-field"><span>Diagnosis reference</span><input required minLength={10} placeholder="Submit a crop observation first" value={diagnosisId} onChange={e=>setDiagnosisId(e.target.value)}/></label><div className="checkout-total"><span>Sample total</span><b>₹{total.toLocaleString('en-IN')}</b></div><Button type="submit" className="wide-button" disabled={!consent||!diagnosisId.trim()||checkout.isPending}>{checkout.isPending?'Saving demo order…':<>Save demo order request <ArrowRight size={15}/></>}</Button>{checkout.isError&&<div className="form-error">Order could not be saved. The batch, diagnosis or account may not pass safety checks.</div>}</aside></form>}</>;
}

const infoContent: Record<string,{kicker:string;title:string;description:string;icon:IconType;heading:string;copy:string;actions:[string,string][]}> = {
 '/irrigation':{kicker:'WATER · FIELD PLANNING',title:'Give every drop a purpose.',description:'Plan a steadier irrigation routine around crop stage and the conditions in your field.',icon:Droplets,heading:'Make the next watering count.',copy:'Check soil moisture at root depth before irrigating. A short field check can prevent overwatering and keep roots healthy.',actions:[['Check today’s weather','/weather'],['See field tasks','/tasks']]},
 '/soil-reports':{kicker:'SOIL HEALTH · FIELD RECORDS',title:'Know what your soil needs.',description:'Keep soil results close to the decisions they inform.',icon:FileText,heading:'Your soil record starts here.',copy:'No laboratory soil report is connected to this demo district account yet. Ask your local soil testing centre about sample collection and keep the report with your farm records.',actions:[['Find local services','/services'],['Ask about a crop','/ask']]},
 '/mandi-prices':{kicker:'MARKET WATCH · TELANGANA',title:'Know the market before you go.',description:'Use local price signals as one part of a well-timed selling decision.',icon:ArrowDownRight,heading:'District mandi rates',copy:'Live district market listings are not connected here yet. Check your nearest mandi or FPO for today’s arrival volume, grade and rate before making a sale.',actions:[['Your farm summary','/dashboard'],['FPO workspace','/fpo-dashboard']]},
 '/schemes':{kicker:'FARMER SUPPORT · PUBLIC PROGRAMMES',title:'Support that meets your needs.',description:'A clearer starting point for finding public agricultural programmes.',icon:BookOpen,heading:'Find the right office first.',copy:'Scheme eligibility depends on crop, land records and local programme rules. Confirm the latest requirements with your agriculture office or FPO before sharing sensitive documents.',actions:[['Talk to a local provider','/services'],['Privacy & data controls','/privacy-audit']]},
 '/pest-map':{kicker:'COMMUNITY SIGNALS · DISTRICT VIEW',title:'Notice patterns, early.',description:'Local reports help neighbours and agronomists spot emerging crop concerns.',icon:MapPin,heading:'No active district reports.',copy:'The pest map has no current verified reports to show. A field observation can help agronomists understand what’s happening nearby.',actions:[['Share a field observation','/ask'],['See cases needing review','/escalations']]},
 '/orders-bookings':{kicker:'YOUR ACTIVITY · FOLLOW-UPS',title:'Keep track of what’s underway.',description:'Orders, service requests and the field tasks that follow them.',icon:Boxes,heading:'Nothing to track yet.',copy:'Order and booking history will appear here after a request is placed. Product orders create a follow-up field task so you can record what happens next.',actions:[['Browse verified products','/marketplace'],['Find farm services','/services']]},
 '/fpo-dashboard':{kicker:'FPO WORKSPACE · MEMBER SUPPORT',title:'A stronger view across the group.',description:'Coordinate member farms, service access and shared field signals.',icon:Users,heading:'Your FPO workspace is ready.',copy:'Member roster and group activity are not connected to this demo district account. Use the linked field tools to help members share observations and find verified providers.',actions:[['Review field tasks','/tasks'],['Find local services','/services']]},
 '/seller-dashboard':{kicker:'SELLER WORKSPACE · PRODUCT TRUST',title:'Trust starts with the batch.',description:'Help farmers see clear labels, reliable stock and verified seller details.',icon:BriefcaseBusiness,heading:'Keep every listing accountable.',copy:'Seller inventory tools are not connected here yet. Product batches shown to farmers must be verified and not recalled before they can be purchased.',actions:[['View the marketplace','/marketplace'],['Check a batch record','/marketplace/authenticity-scanner']]},
 '/admin':{kicker:'DISTRICT OPERATIONS · SAFETY',title:'A view built around accountability.',description:'Keep local services, product trust and agronomist review in sight.',icon:Shield,heading:'Safety overview',copy:'Review cases needing a human decision and inspect privacy audit details. Administrative data is not connected to this demo account.',actions:[['Open escalation queue','/escalations'],['Review privacy controls','/privacy-audit']]},
 '/privacy-audit':{kicker:'PRIVACY · YOUR INFORMATION',title:'Your farm information belongs to you.',description:'A clear account of what the field desk uses and why.',icon:Fingerprint,heading:'Purpose-bound by default.',copy:'Your crop observation is processed to help prepare crop guidance. Photo attachments are optional. Consent is required before an observation is analysed. No information is used for unrelated purposes in this demo.',actions:[['Ask a crop question','/ask'],['Read field safety guidance','/dashboard']]},
 '/verification':{kicker:'FIELD TASK · EVIDENCE',title:'Record what happened in the field.',description:'Close the loop on a recommended action with a clear field note.',icon:ClipboardCheck,heading:'Verification is still open.',copy:'No task-specific verification record is available. Open your task list to review assigned steps, or share a new observation if the crop has changed.',actions:[['See field tasks','/tasks'],['Share a new observation','/ask']]},
};
function InfoPage({path}: {path:string}) {
 const page=infoContent[path]||infoContent['/irrigation']; const Icon=page.icon;
 return <><PageHeading kicker={page.kicker} title={page.title} description={page.description}/><section className="info-feature panel"><div className="info-feature-art"><div className="info-orbit orbit-one"/><div className="info-orbit orbit-two"/><div className="info-icon"><Icon size={34}/></div><span className="info-coordinate">FIELD NOTE / NEXUS</span></div><div className="info-feature-copy"><div className="eyebrow">A PRACTICAL STARTING POINT</div><h2>{page.heading}</h2><p>{page.copy}</p><div className="info-actions">{page.actions.map(([text,href])=><Link className="button button-outline" key={href} href={href}>{text}<ArrowRight size={14}/></Link>)}</div></div></section><section className="trust-strip"><div><Shield size={18}/><b>Safety before certainty</b><span>Human review where it matters</span></div><div><Cloud size={18}/><b>Made for rural connectivity</b><span>Keep useful next steps close</span></div><div><Users size={18}/><b>Local knowledge matters</b><span>Connect with trusted support</span></div></section></>;
}

function NotFound() { return <div className="not-found"><Sprout size={28}/><div className="eyebrow">FIELD DESK · 404</div><h1>This path isn’t in the field map.</h1><p>The page may have moved. You can return to your farm summary.</p><Link href="/dashboard" className="button button-primary">Back to the field desk <ArrowRight size={16}/></Link></div>; }

function RoutedErrorBoundary({children}:{children:ReactNode}) {
 const [location] = useLocation();
 return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function Workspace() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="auth-loading">Loading your field desk…</div>;
  if (!isSignedIn) return <Redirect to="/" />;
 return <Shell><RoutedErrorBoundary><Switch>
  <Route path="/dashboard" component={Dashboard}/><Route path="/ask" component={Intake}/>
  <Route path="/diagnosis/:diagnosisId" component={DiagnosisPage}/><Route path="/treatments/:diagnosisId" component={TreatmentsPage}/>
  <Route path="/weather" component={WeatherPage}/><Route path="/tasks" component={TasksPage}/><Route path="/escalations" component={EscalationsPage}/>
  <Route path="/services" component={ServicesPage}/><Route path="/marketplace" component={Marketplace}/>
  <Route path="/marketplace/product/:id" component={ProductDetail}/><Route path="/marketplace/authenticity-scanner" component={ScannerPage}/>
  <Route path="/marketplace/cart-checkout" component={CheckoutPage}/>
  <Route path="/irrigation" component={()=> <InfoPage path="/irrigation"/>}/>
  <Route path="/soil-reports" component={()=> <InfoPage path="/soil-reports"/>}/>
  <Route path="/mandi-prices" component={()=> <InfoPage path="/mandi-prices"/>}/>
  <Route path="/schemes" component={()=> <InfoPage path="/schemes"/>}/>
  <Route path="/pest-map" component={()=> <InfoPage path="/pest-map"/>}/>
  <Route path="/orders-bookings" component={()=> <InfoPage path="/orders-bookings"/>}/>
  <Route path="/fpo-dashboard" component={()=> <InfoPage path="/fpo-dashboard"/>}/>
  <Route path="/seller-dashboard" component={()=> <InfoPage path="/seller-dashboard"/>}/>
  <Route path="/admin" component={()=> <InfoPage path="/admin"/>}/>
  <Route path="/privacy-audit" component={()=> <InfoPage path="/privacy-audit"/>}/>
  <Route path="/verification/:taskId" component={()=> <InfoPage path="/verification"/>}/>
  <Route component={NotFound}/>
 </Switch></RoutedErrorBoundary></Shell>;
}
function HomeRedirect() {
  return <>
    <Show when="signed-in"><Redirect to="/dashboard"/></Show>
    <Show when="signed-out"><Welcome/></Show>
  </>;
}
function Router() {
  return <Switch>
    <Route path="/" component={HomeRedirect}/>
    <Route path="/auth/login" component={Login}/>
    <Route path="/sign-in/*?" component={SignInPage}/>
    <Route path="/sign-up/*?" component={SignUpPage}/>
    <Route><Workspace/></Route>
  </Switch>;
}
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);
  return null;
}
function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to access your field desk.' } },
      signUp: { start: { title: 'Create your account', subtitle: 'Start keeping your farm notes together.' } },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ClerkQueryClientCacheInvalidator/>
        <Router/>
        <Toaster/>
      </TooltipProvider>
    </QueryClientProvider>
  </ClerkProvider>;
}
function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes/></WouterRouter>;
}
export default App;
