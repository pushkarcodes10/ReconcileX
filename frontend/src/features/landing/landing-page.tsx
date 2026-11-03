import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/auth-provider';
import {
  LogoIcon,
  SparkleIcon,
  StarIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  ShieldCheckIcon,
  CpuIcon,
  XIcon,
} from '../../shared/components/icons';
import './landing-page.css';

interface FeatureTab {
  id: string;
  number: string;
  title: string;
  description: string;
  tag: string;
  sourceA: { name: string; ref: string; amount: string; date: string };
  sourceB: { name: string; ref: string; amount: string; date: string };
  confidence: number;
  status: 'EXACT_MATCH' | 'FUZZY_MATCH' | 'FLAGGED';
}

const FEATURE_TABS: FeatureTab[] = [
  {
    id: 'ingestion',
    number: '01',
    title: 'Multi-Source Ingestion & Quarantine',
    description:
      'Ingest massive CSV, JSON, and webhook transaction dumps. Corrupted or invalid rows are safely quarantined with line-number audit traces while healthy batches process instantly.',
    tag: 'Automated Normalization',
    sourceA: { name: 'Internal Orders (CSV)', ref: 'ORD-89421', amount: '$1,450.00', date: '2026-11-03' },
    sourceB: { name: 'Stripe Settlement (API)', ref: 'ch_3N82x4kL', amount: '$1,450.00', date: '2026-11-03' },
    confidence: 1.0,
    status: 'EXACT_MATCH',
  },
  {
    id: 'matching',
    number: '02',
    title: 'Deterministic & Fuzzy Rule Engine',
    description:
      'Multi-pass reconciliation engine pairs exact external reference IDs first, then applies user-configurable fuzzy amount tolerances (±$0.05) and sliding date windows (±3 days).',
    tag: 'High-Throughput Scoring',
    sourceA: { name: 'Internal Orders', ref: 'INV-2026-091', amount: '$4,820.50', date: '2026-11-01' },
    sourceB: { name: 'JPMorgan Wire Feed', ref: 'WT-992144', amount: '$4,820.50', date: '2026-11-02' },
    confidence: 0.96,
    status: 'FUZZY_MATCH',
  },
  {
    id: 'exceptions',
    number: '03',
    title: 'Finite-State Exception Queue',
    description:
      'Strict FSM state machine transitions (OPEN → INVESTIGATING → RESOLVED / ESCALATED). Prevent unhandled discrepancies from falling through the cracks with role-based resolution gates.',
    tag: 'Zero Discrepancy Leakage',
    sourceA: { name: 'E-Commerce Checkout', ref: 'ORD-77190', amount: '$312.00', date: '2026-10-29' },
    sourceB: { name: 'Bank Statement', ref: 'DEP-88301', amount: '$310.00', date: '2026-10-30' },
    confidence: 0.72,
    status: 'FLAGGED',
  },
  {
    id: 'compliance',
    number: '04',
    title: 'Tamper-Evident Audit Compliance',
    description:
      'Every single file upload, automatic pairing, manual investigator override, and state transition is cryptographically actor-stamped for instant, stress-free SOC-2 compliance.',
    tag: 'SOC-2 Ready Audit Trail',
    sourceA: { name: 'Internal Ledger', ref: 'TX-90114', amount: '$12,400.00', date: '2026-11-02' },
    sourceB: { name: 'Direct Debit Feed', ref: 'ACH-44109', amount: '$12,400.00', date: '2026-11-02' },
    confidence: 1.0,
    status: 'EXACT_MATCH',
  },
];

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [activeTabId, setActiveTabId] = useState<string>('matching');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [previewConfirmed, setPreviewConfirmed] = useState<boolean>(false);

  const activeTab = FEATURE_TABS.find((t) => t.id === activeTabId) || FEATURE_TABS[0];

  return (
    <div className="rx-landing">
      {/* -------------------------------------------------------------
          1. NAVIGATION BAR
      ------------------------------------------------------------- */}
      <header className="rx-landing-nav">
        <div className="rx-landing-container rx-landing-nav-inner">
          <Link to="/" className="rx-landing-brand" aria-label="ReconcileX Home">
            <LogoIcon size={28} />
            <span>ReconcileX</span>
          </Link>

          <nav className="rx-landing-links" aria-label="Main Navigation">
            <a href="#platform">Platform</a>
            <a href="#engine">Engine</a>
            <a href="#workflow">How It Works</a>
            <a href="#metrics">Impact</a>
            <a href="#security">Security</a>
          </nav>

          <div className="rx-landing-nav-actions">
            {isAuthenticated ? (
              <button
                onClick={() => navigate('/select-org')}
                className="rx-pill-btn rx-pill-btn-dark"
                aria-label="Open Workspace"
              >
                <span>Go to Workspace</span>
                <ArrowRightIcon size={14} />
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rx-pill-btn rx-pill-btn-ghost"
                  aria-label="Sign In"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="rx-pill-btn rx-pill-btn-dark"
                  aria-label="Get Started"
                >
                  Get Started
                </Link>
              </>
            )}

            <button
              className="rx-landing-mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <XIcon size={22} /> : <div style={{ fontSize: '1.25rem' }}>☰</div>}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            style={{
              padding: '1.25rem 1.5rem',
              backgroundColor: '#FFFFFF',
              borderBottom: '1px solid var(--rx-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <a
              href="#platform"
              onClick={() => setMobileMenuOpen(false)}
              style={{ fontWeight: 600, color: 'var(--rx-text-primary)' }}
            >
              Platform
            </a>
            <a
              href="#engine"
              onClick={() => setMobileMenuOpen(false)}
              style={{ fontWeight: 600, color: 'var(--rx-text-primary)' }}
            >
              Matching Engine
            </a>
            <a
              href="#workflow"
              onClick={() => setMobileMenuOpen(false)}
              style={{ fontWeight: 600, color: 'var(--rx-text-primary)' }}
            >
              How It Works
            </a>
            <a
              href="#metrics"
              onClick={() => setMobileMenuOpen(false)}
              style={{ fontWeight: 600, color: 'var(--rx-text-primary)' }}
            >
              Impact Metrics
            </a>
            <a
              href="#security"
              onClick={() => setMobileMenuOpen(false)}
              style={{ fontWeight: 600, color: 'var(--rx-text-primary)' }}
            >
              Security
            </a>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Link
                to="/login"
                className="rx-pill-btn rx-pill-btn-outline"
                style={{ flex: 1, textAlign: 'center' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="rx-pill-btn rx-pill-btn-dark"
                style={{ flex: 1, textAlign: 'center' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* -------------------------------------------------------------
          2. HERO SECTION
      ------------------------------------------------------------- */}
      <section className="rx-landing-hero" id="platform">
        <div className="rx-landing-container">
          <div className="rx-landing-rating-pill">
            <span className="star-gold">
              <StarIcon size={14} />
            </span>
            <span>4.9/5 Rating from 250+ Enterprise Finance Teams</span>
          </div>

          <h1 className="rx-landing-hero-title">
            Reconcile millions in seconds with autonomous precision
          </h1>

          <p className="rx-landing-hero-subtitle">
            Multi-source ingestion. 99.8% automated rule matching. Instant exception triage. Close your
            books 10x faster with mathematical confidence and complete audit integrity.
          </p>

          <div className="rx-landing-hero-ctas">
            <Link to="/register" className="rx-pill-btn rx-pill-btn-dark" style={{ padding: '0.85rem 1.75rem', fontSize: '1rem' }}>
              <span>Get started for free</span>
              <ArrowRightIcon size={16} />
            </Link>
            <Link to="/login" className="rx-pill-btn rx-pill-btn-outline" style={{ padding: '0.85rem 1.6rem', fontSize: '1rem' }}>
              <span>Sign In to Console</span>
            </Link>
          </div>

          {/* Defining Visual: Organic Flowing Mesh Gradient Canvas with Floating Agent Card */}
          <div className="rx-hero-canvas">
            <div className="rx-hero-canvas-art" />

            <div className="rx-hero-agent-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="rx-hero-agent-tag">
                  <SparkleIcon size={12} />
                  <span>Autonomous Reconciliation Engine v1.4</span>
                </span>
                <span style={{ fontSize: '0.75rem', color: '#15803D', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#15803D' }} />
                  Live Sync
                </span>
              </div>

              <div className="rx-hero-agent-input">
                <SparkleIcon size={16} style={{ color: '#20231F' }} />
                <span className="rx-hero-agent-input-text">
                  Auto-reconciling 48,290 Stripe transactions against JPMorgan Chase ledger...
                </span>
                <button
                  className="rx-hero-agent-input-btn"
                  aria-label="Process Run"
                  onClick={() => navigate(isAuthenticated ? '/select-org' : '/login')}
                >
                  <ArrowRightIcon size={14} />
                </button>
              </div>

              <div className="rx-hero-pills-row">
                <span className="rx-hero-mini-pill pill-green">
                  <CheckCircleIcon size={12} />
                  <span>48,194 Exact Matches (100% confidence)</span>
                </span>
                <span className="rx-hero-mini-pill pill-blue">
                  <CpuIcon size={12} />
                  <span>96 Potential Matches (1-click review)</span>
                </span>
                <span className="rx-hero-mini-pill pill-yellow">
                  <ShieldCheckIcon size={12} />
                  <span>Dual-source SHA-256 verified</span>
                </span>
              </div>

              <div className="rx-hero-agent-footer">
                <span>Tolerance window: ±$0.02 • 3-day buffer</span>
                <span style={{ fontWeight: 600, color: 'var(--rx-text-primary)' }}>Execution: 1.84s</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------
          3. SOCIAL PROOF / LOGOS BAR
      ------------------------------------------------------------- */}
      <section className="rx-landing-logos">
        <div className="rx-landing-container">
          <p className="rx-logos-tag">
            Powering Ledger Reconciliation For High-Growth Fintechs & Enterprises
          </p>

          <div className="rx-logos-grid">
            <div className="rx-logo-item">
              <span style={{ fontWeight: 900 }}>stripe</span>
            </div>
            <div className="rx-logo-item">
              <span>PLAID</span>
            </div>
            <div className="rx-logo-item">
              <span>J.P. Morgan</span>
            </div>
            <div className="rx-logo-item">
              <span style={{ letterSpacing: '0.1em' }}>BREX</span>
            </div>
            <div className="rx-logo-item">
              <span>RAMP</span>
            </div>
            <div className="rx-logo-item">
              <span>MERCURY</span>
            </div>
            <div className="rx-logo-item">
              <span style={{ fontWeight: 800 }}>adyen</span>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------
          4. EDITORIAL TESTIMONIAL FEATURE (Reference 3 Aesthetic)
      ------------------------------------------------------------- */}
      <section className="rx-landing-quote-section">
        <div className="rx-landing-container">
          <div className="rx-quote-card">
            <div>
              <p className="rx-quote-text">
                “ReconcileX transformed our month-end close from 9 days of manual spreadsheet chaos
                into a 20-minute automated review. The exception workflow alone saved our finance team
                over 40 hours every single month.”
              </p>

              <div className="rx-quote-author">
                <div className="rx-quote-avatar">MV</div>
                <div className="rx-quote-meta">
                  <h4>Marcus Vance</h4>
                  <p>VP of Finance & Operations, ScalePay Global</p>
                </div>
              </div>
            </div>

            <div>
              <Link
                to="/register"
                className="rx-pill-btn rx-pill-btn-dark"
                style={{ padding: '0.85rem 1.6rem' }}
              >
                <span>Read Customer Story</span>
                <ArrowUpRightIcon size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------
          5. BENTO METRICS HIGHLIGHTS (3 Cards)
      ------------------------------------------------------------- */}
      <section className="rx-landing-metrics" id="metrics">
        <div className="rx-landing-container">
          <div className="rx-section-header">
            <span className="rx-section-tag">Proven Impact</span>
            <h2 className="rx-section-title">
              Engineered for enterprise scale and mathematical precision
            </h2>
            <p className="rx-section-subtitle">
              Designed to handle massive transaction velocity with deterministic accuracy and zero human fatigue.
            </p>
          </div>

          <div className="rx-metrics-grid">
            <div className="rx-metric-card">
              <div className="rx-metric-value">10x</div>
              <div className="rx-metric-label">Faster Financial Close</div>
              <p className="rx-metric-desc">
                Compress multi-day manual reconciliations into automated sub-second background jobs. Close books in 4 hours instead of 8 days.
              </p>
            </div>

            <div className="rx-metric-card" style={{ background: '#FAF8DF', borderColor: '#F0ECA0' }}>
              <div className="rx-metric-value">99.8%</div>
              <div className="rx-metric-label">Automated Match Rate</div>
              <p className="rx-metric-desc">
                High-confidence classification and multi-pass scoring pair the vast majority of records without requiring manual intervention.
              </p>
            </div>

            <div className="rx-metric-card">
              <div className="rx-metric-value">0</div>
              <div className="rx-metric-label">Spreadsheet Discrepancies</div>
              <p className="rx-metric-desc">
                Eliminate broken VLOOKUP formulas, copy-paste human errors, and unreviewed discrepancies with immutable, actor-stamped records.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------
          6. FEATURE DEEP-DIVE & INTERACTIVE PREVIEW
      ------------------------------------------------------------- */}
      <section className="rx-landing-features" id="engine">
        <div className="rx-landing-container">
          <div className="rx-section-header" style={{ textAlign: 'left', margin: '0 0 3rem' }}>
            <span className="rx-section-tag">Core Architecture</span>
            <h2 className="rx-section-title">
              We help finance teams eliminate discrepancies before they compound
            </h2>
            <p className="rx-section-subtitle">
              Explore the four core pillars of the ReconcileX reconciliation platform.
            </p>
          </div>

          <div className="rx-features-split">
            {/* Left Column: Interactive Feature Selection */}
            <div>
              {FEATURE_TABS.map((tab) => (
                <div
                  key={tab.id}
                  className={`rx-feature-item ${activeTabId === tab.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTabId(tab.id);
                    setPreviewConfirmed(false);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setActiveTabId(tab.id);
                      setPreviewConfirmed(false);
                    }
                  }}
                >
                  <div className="rx-feature-item-num">{tab.number}</div>
                  <div className="rx-feature-item-title">{tab.title}</div>
                  <p className="rx-feature-item-desc">{tab.description}</p>
                </div>
              ))}
            </div>

            {/* Right Column: Live Interactive Match Preview Card */}
            <div className="rx-feature-preview-box">
              <div className="rx-preview-pill-header">
                <div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: 'var(--rx-text-secondary)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Interactive Match Inspector
                  </span>
                  <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '2px' }}>
                    {activeTab.tag}
                  </div>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    background: previewConfirmed
                      ? '#DCFCE7'
                      : activeTab.confidence >= 0.95
                      ? '#DCFCE7'
                      : '#FEF3C7',
                    color: previewConfirmed
                      ? '#15803D'
                      : activeTab.confidence >= 0.95
                      ? '#15803D'
                      : '#B45309',
                  }}
                >
                  {previewConfirmed ? (
                    <>
                      <CheckCircleIcon size={14} />
                      <span>MATCH CERTIFIED</span>
                    </>
                  ) : (
                    <>
                      <SparkleIcon size={12} />
                      <span>{(activeTab.confidence * 100).toFixed(0)}% Confidence</span>
                    </>
                  )}
                </div>
              </div>

              {/* Source A Card */}
              <div className="rx-preview-match-card">
                <div className="rx-preview-row">
                  <span style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)', fontWeight: 600 }}>
                    Source A: {activeTab.sourceA.name}
                  </span>
                  <span style={{ fontFamily: 'var(--rx-font-mono)', fontSize: '0.8125rem', color: 'var(--rx-text-muted)' }}>
                    {activeTab.sourceA.date}
                  </span>
                </div>
                <div className="rx-preview-row" style={{ marginBottom: 0 }}>
                  <span style={{ fontFamily: 'var(--rx-font-mono)', fontWeight: 700, fontSize: '0.9375rem' }}>
                    {activeTab.sourceA.ref}
                  </span>
                  <span style={{ fontFamily: 'var(--rx-font-mono)', fontWeight: 800, fontSize: '1.1rem' }}>
                    {activeTab.sourceA.amount}
                  </span>
                </div>
              </div>

              {/* Source B Card */}
              <div className="rx-preview-match-card">
                <div className="rx-preview-row">
                  <span style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)', fontWeight: 600 }}>
                    Source B: {activeTab.sourceB.name}
                  </span>
                  <span style={{ fontFamily: 'var(--rx-font-mono)', fontSize: '0.8125rem', color: 'var(--rx-text-muted)' }}>
                    {activeTab.sourceB.date}
                  </span>
                </div>
                <div className="rx-preview-row" style={{ marginBottom: 0 }}>
                  <span style={{ fontFamily: 'var(--rx-font-mono)', fontWeight: 700, fontSize: '0.9375rem' }}>
                    {activeTab.sourceB.ref}
                  </span>
                  <span style={{ fontFamily: 'var(--rx-font-mono)', fontWeight: 800, fontSize: '1.1rem' }}>
                    {activeTab.sourceB.amount}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="rx-pill-btn rx-pill-btn-dark"
                  style={{ flex: 1 }}
                  onClick={() => setPreviewConfirmed(true)}
                >
                  {previewConfirmed ? 'Verified in Audit Log' : 'Confirm Potential Match'}
                </button>
                <Link
                  to="/register"
                  className="rx-pill-btn rx-pill-btn-outline"
                  style={{ padding: '0.625rem 1rem' }}
                >
                  Inspect Live
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------
          7. HOW IT WORKS (Workflow Section)
      ------------------------------------------------------------- */}
      <section className="rx-landing-workflow" id="workflow">
        <div className="rx-landing-container">
          <div className="rx-section-header">
            <span className="rx-section-tag">Step-by-Step Execution</span>
            <h2 className="rx-section-title">The Complete Reconciliation Lifecycle</h2>
            <p className="rx-section-subtitle">
              From raw fragmented CSV dumps to auditor-ready signed reconciliation reports in four simple steps.
            </p>
          </div>

          <div className="rx-workflow-grid">
            <div className="rx-workflow-step">
              <div className="rx-workflow-step-badge">1</div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Ingest & Normalize
              </h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--rx-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Drop CSVs or connect payment APIs. Column mappings and currency normalization occur automatically with bad row isolation.
              </p>
            </div>

            <div className="rx-workflow-step">
              <div className="rx-workflow-step-badge">2</div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Multi-Pass Matching
              </h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--rx-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                The high-throughput matching engine executes exact external ID matches, followed by tolerance-aware fuzzy scoring.
              </p>
            </div>

            <div className="rx-workflow-step">
              <div className="rx-workflow-step-badge">3</div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Triage Exceptions
              </h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--rx-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Edge-case discrepancies route into structured investigation queues with role assignment and required resolution notes.
              </p>
            </div>

            <div className="rx-workflow-step">
              <div className="rx-workflow-step-badge">4</div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Certify & Sync
              </h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--rx-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Generate certified reconciliation certificates with immutable actor stamps ready for external auditor sign-off.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------
          8. BIG IMPACT NUMBER (Reference 3 Grand Scale Proof)
      ------------------------------------------------------------- */}
      <section className="rx-landing-impact">
        <div className="rx-landing-container">
          <div className="rx-impact-tag">Don't take our word for it</div>
          <div className="rx-impact-number">$42,850,000,000</div>
          <p className="rx-impact-caption">
            in verified transaction volume reconciled across leading payment processors, marketplaces, and global neobanks.
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------------
          9. FINAL HIGH-CONTRAST CALL TO ACTION
      ------------------------------------------------------------- */}
      <section className="rx-landing-cta-banner" id="security">
        <div className="rx-landing-container">
          <div className="rx-cta-card">
            <h2>Ready to eliminate manual reconciliation for good?</h2>
            <p>
              Join forward-thinking finance teams who trust ReconcileX for continuous, audit-ready financial ledger accuracy.
            </p>

            <div className="rx-cta-actions">
              <Link
                to="/register"
                className="rx-pill-btn rx-pill-btn-lime"
                style={{ padding: '0.85rem 1.85rem', fontSize: '1rem' }}
              >
                <span>Get Started for Free</span>
                <ArrowRightIcon size={16} />
              </Link>
              <Link
                to="/login"
                className="rx-pill-btn rx-pill-btn-outline"
                style={{
                  background: 'transparent',
                  color: '#FFFFFF',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  padding: '0.85rem 1.6rem',
                  fontSize: '1rem',
                }}
              >
                <span>Sign In to Console</span>
              </Link>
            </div>

            <div className="rx-cta-badges">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheckIcon size={16} style={{ color: 'var(--rx-lime)' }} />
                <span>SOC-2 Type II Certified</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircleIcon size={16} style={{ color: 'var(--rx-lime)' }} />
                <span>Bank-Grade 256-Bit TLS</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CpuIcon size={16} style={{ color: 'var(--rx-lime)' }} />
                <span>Strict Tenant Isolation</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------
          10. FOOTER
      ------------------------------------------------------------- */}
      <footer className="rx-landing-footer">
        <div className="rx-landing-container">
          <div className="rx-footer-grid">
            <div>
              <div className="rx-landing-brand" style={{ marginBottom: '0.5rem' }}>
                <LogoIcon size={26} />
                <span>ReconcileX</span>
              </div>
              <p className="rx-footer-brand-p">
                High-throughput autonomous financial reconciliation and exception triage platform for modern enterprises.
              </p>
            </div>

            <div className="rx-footer-col">
              <h5>Platform</h5>
              <ul>
                <li><a href="#platform">Overview</a></li>
                <li><a href="#engine">Matching Engine</a></li>
                <li><a href="#workflow">Exception Queue</a></li>
                <li><a href="#security">Audit Compliance</a></li>
              </ul>
            </div>

            <div className="rx-footer-col">
              <h5>Solutions</h5>
              <ul>
                <li><a href="#metrics">Fintech & Payments</a></li>
                <li><a href="#metrics">Marketplaces</a></li>
                <li><a href="#metrics">Subscription SaaS</a></li>
                <li><a href="#metrics">Neobanks & Wallets</a></li>
              </ul>
            </div>

            <div className="rx-footer-col">
              <h5>Access</h5>
              <ul>
                <li><Link to="/login">Sign In</Link></li>
                <li><Link to="/register">Create Account</Link></li>
                <li><Link to="/forgot-password">Password Recovery</Link></li>
                <li><a href="#security">Security Whitepaper</a></li>
              </ul>
            </div>

            <div className="rx-footer-col">
              <h5>Compliance</h5>
              <ul>
                <li><a href="#security">SOC-2 Type II</a></li>
                <li><a href="#security">GDPR Privacy</a></li>
                <li><a href="#security">Terms of Service</a></li>
                <li><a href="#security">Security Disclosures</a></li>
              </ul>
            </div>
          </div>

          <div className="rx-footer-bottom">
            <div>© {new Date().getFullYear()} ReconcileX Inc. All rights reserved.</div>

            <div className="rx-footer-status-pill">
              <span className="rx-footer-status-dot" />
              <span>All Systems Operational • 99.99%</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
