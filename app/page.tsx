import Link from "next/link";
import { Hero } from "@/components/homepage/Hero";
import { ProblemSection } from "@/components/homepage/ProblemSection";
import { ChaosSection } from "@/components/homepage/ChaosSection";
import { ReconcileXReveal } from "@/components/homepage/ReconcileXReveal";
import { WorkflowSection } from "@/components/homepage/WorkflowSection";
import { MatchingEngineSection } from "@/components/homepage/MatchingEngineSection";
import { ExceptionManagementSection } from "@/components/homepage/ExceptionManagementSection";
import { AuditTrailSection } from "@/components/homepage/AuditTrailSection";
import { FeaturesSection } from "@/components/homepage/FeaturesSection";
import { ArchitectureSection } from "@/components/homepage/ArchitectureSection";
import { CTASection } from "@/components/homepage/CTASection";

export default function HomePage() {
  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 bg-navy-900/80 backdrop-blur-lg border-b border-navy-700" role="navigation" aria-label="Main navigation">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2" aria-label="ReconcileX Home">
              <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-navy-900" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="font-semibold text-lg text-white">ReconcileX</span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Product</a>
              <a href="#workflow" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">How It Works</a>
              <a href="#features" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Features</a>
              <a href="#architecture" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Architecture</a>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <Link href="/dashboard" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Sign In</Link>
              <Link href="/dashboard" className="px-4 py-2 text-sm font-medium text-navy-900 bg-cyan-500 rounded-lg hover:bg-cyan-400 transition-colors">Open Dashboard</Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        <Hero />
        <ProblemSection />
        <ChaosSection />
        <ReconcileXReveal />
        <WorkflowSection />
        <MatchingEngineSection />
        <ExceptionManagementSection />
        <AuditTrailSection />
        <FeaturesSection />
        <ArchitectureSection />
        <CTASection />
      </main>

      <footer className="bg-navy-950 border-t border-navy-800 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center gap-2 mb-4" aria-label="ReconcileX Home">
                <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center">
                  <svg className="w-5 h-5 text-navy-900" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <span className="font-semibold text-lg text-white">ReconcileX</span>
              </Link>
              <p className="text-gray-400 max-w-xs">Turn fragmented transaction data into one clear financial picture.</p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#workflow" className="hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#architecture" className="hover:text-white transition-colors">Architecture</a></li>
                <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-navy-800 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <p>&copy; 2026 ReconcileX. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Security</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}