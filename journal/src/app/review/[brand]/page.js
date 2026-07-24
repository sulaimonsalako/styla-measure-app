"use client";

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { brandReviews } from '../../../data/journalData';

export default function ReviewDetail({
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('sb-tneflxtpmzodauygtslk-auth-token') : null;
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.clear();
      setIsLoggedIn(false);
      window.location.href = '/index.html';
    }
  };

  const handleLoginRedirect = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/index.html?login=true';
    }
  };
 params }) {
  const resolvedParams = use(params);
  const brandId = resolvedParams.brand;
  const brand = brandReviews.find(b => b.id === brandId);
  const [chatResponse, setChatResponse] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [scanModalOpen, setScanModalOpen] = useState(false);

  if (!brand) {
    return (
      <div className="min-h-screen bg-bg-dark text-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="font-serif text-3xl font-bold mb-4">Review Not Found</h1>
        <p className="text-text-muted mb-6">The brand review you are looking for does not exist or has been moved.</p>
        <Link href="/" className="bg-accent-pink hover:bg-accent-light text-white font-bold py-2 px-6 rounded-full transition-colors btn-pink-glow">
          Back to Journal Home
        </Link>
      </div>
    );
  }

  const askAI = (promptText) => {
    setIsChatLoading(true);
    setChatInput(promptText);
    setChatResponse('');
    setTimeout(() => {
      setIsChatLoading(false);
      let reply = `Regarding ${brand.name}'s sizing, reviews highlight that their sizing typically runs ${brand.id === 'jenny-yoo' || brand.id === 'revelry' ? 'smaller than street clothes, so sizing up is recommended' : 'true to standard charts, but height alterations are almost universally required'}. To guarantee a perfect fit, we recommend running a free 3D Body Scan on STYLA.`;
      setChatResponse(reply);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-bg-dark text-text-white relative font-sans">
      
      {/* NAVIGATION */}
            <nav className="border-b border-border-card bg-bg-dark/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="/index.html" className="flex items-center gap-2.5 font-serif text-xl font-bold tracking-tight">
            <img src="/logo.png" alt="STYLA Logo" className="w-8 h-8 rounded-full object-cover shadow-[0_0_12px_rgba(255,42,117,0.4)]" />
            STYLA <span className="text-accent-pink italic font-normal">Measure</span>
          </a>
          <div className="flex items-center gap-6">
            <a href="/bridesmaid.html" className="text-sm font-semibold text-text-muted hover:text-white transition-colors">
              Bridesmaid
            </a>
            {!isLoggedIn && (
              <a href="/brands.html" className="text-sm font-semibold text-text-muted hover:text-white transition-colors">
                For Fashion Brands
              </a>
            )}
            <a href="/blogs" className="text-sm font-semibold text-text-white transition-colors">
              Blogs
            </a>
            {!isLoggedIn ? (
              <button 
                onClick={handleLoginRedirect}
                className="bg-gradient-to-r from-[#e11d48] to-accent-pink text-white text-sm font-bold py-2 px-5 rounded-full btn-pink-glow"
              >
                Log In
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-[#10b981]">✔ Synced</span>
                <button 
                  onClick={handleLogout}
                  className="bg-gradient-to-r from-[#e11d48] to-accent-pink text-white text-sm font-bold py-2 px-5 rounded-full btn-pink-glow"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* REVIEW DETAILS */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* Main Content */}
        <main className="lg:col-span-2 flex flex-col gap-6">
          <div className="flex justify-between items-start border-b border-white/5 pb-6">
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase font-bold text-accent-light tracking-wider">🏬 Brand Fit Review</span>
              <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight">
                {brand.name} Sizing Review
              </h1>
              <p className="text-xs text-text-muted mt-2">Expert sizing diagnostics & customer fit evaluations.</p>
            </div>
            <span className="bg-[#ff2a75]/15 border border-[#ff2a75]/30 text-accent-light font-bold py-1.5 px-4 rounded-full text-xs md:text-sm">
              {brand.rating} Rating
            </span>
          </div>

          <div className="bg-card-bg border border-border-card rounded-2xl p-6 flex flex-col gap-4">
            <h2 className="font-serif text-xl font-bold text-white">Fit Overview</h2>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">{brand.desc}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2">
            <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-2xl flex flex-col gap-3">
              <h3 className="text-emerald-400 font-bold text-sm">✓ Pros</h3>
              <p className="text-xs text-text-secondary leading-relaxed">{brand.pros}</p>
            </div>
            <div className="bg-rose-500/5 border border-rose-500/20 p-6 rounded-2xl flex flex-col gap-3">
              <h3 className="text-rose-400 font-bold text-sm">✗ Cons</h3>
              <p className="text-xs text-text-secondary leading-relaxed">{brand.cons}</p>
            </div>
          </div>

          {/* Sizing Recommendations table */}
          <div className="bg-card-bg border border-border-card rounded-2xl p-6 mt-4">
            <h3 className="font-serif text-lg font-bold text-white mb-4">Recommended Sizing Strategy</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-text-secondary">
                <thead>
                  <tr className="border-b border-white/10 text-white">
                    <th className="pb-2">Measurement Category</th>
                    <th className="pb-2">Fit Priority</th>
                    <th className="pb-2">Ease Allowance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/5">
                    <td className="py-2.5 font-bold">Chest / Bust</td>
                    <td className="py-2.5">Hard Constraint</td>
                    <td className="py-2.5">+2.0" to +4.0"</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2.5 font-bold">Waist</td>
                    <td className="py-2.5">Semi-Critical</td>
                    <td className="py-2.5">+1.0" to +2.0"</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2.5 font-bold">Seat / Hips</td>
                    <td className="py-2.5">Hard Constraint</td>
                    <td className="py-2.5">+2.0" to +4.0"</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-bold">Body Length</td>
                    <td className="py-2.5">Linear (Hemmable)</td>
                    <td className="py-2.5">+1.0" to +3.0"</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* Sidebar Widgets */}
        <aside className="lg:col-span-1 flex flex-col gap-8">
          
          {/* Ask AI Widget */}
          <div className="bg-card-bg border border-[#ff2a75]/25 rounded-2xl p-6 shadow-xl flex flex-col gap-4 sticky top-24">
            <div>
              <span className="text-xs font-bold text-accent-light uppercase tracking-wider">AI Sizing Stylist</span>
              <h3 className="font-serif text-lg font-bold text-white mt-1">Ask STYLA About {brand.name}</h3>
            </div>
            
            {chatResponse ? (
              <div className="bg-bg-dark/80 border border-white/5 p-3 rounded-xl text-xs text-text-muted leading-relaxed">
                {chatResponse}
              </div>
            ) : (
              <p className="text-xs text-text-muted leading-relaxed">
                Have specific concerns about {brand.name}'s sizing charts, fabric stretch, or return policies? Ask STYLA AI.
              </p>
            )}

            <div className="flex flex-col gap-2">
              <input 
                type="text" 
                placeholder={`Ask about ${brand.name}...`} 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && askAI(chatInput)}
                className="bg-bg-dark/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-text-muted outline-none focus:border-accent-light"
              />
              <button 
                onClick={() => askAI(chatInput || `Should I size up in ${brand.name}?`)}
                className="w-full bg-accent-pink hover:bg-accent-light text-white font-bold py-2 rounded-xl text-xs transition-colors"
              >
                {isChatLoading ? "Thinking..." : "Submit Question"}
              </button>
            </div>
          </div>

        </aside>
      </div>

      {/* FOOTER */}
      <footer className="footer border-t border-white/5 py-12 bg-bg-dark mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 items-center text-center">
            <div className="logo flex items-center gap-2.5 font-serif text-xl font-bold tracking-tight">
              <img src="/logo.png" alt="STYLA Logo" className="w-8 h-8 rounded-full object-cover shadow-[0_0_12px_rgba(255,42,117,0.4)]" />
              STYLA <span className="logo-accent text-accent-pink">Measure</span>
            </div>

            <div className="footer-socials flex gap-5">
              <a href="https://instagram.com/stylaca" target="_blank" className="text-xs text-text-muted hover:text-accent-pink transition-colors">Instagram</a>
              <a href="https://tiktok.com/@stylaca" target="_blank" className="text-xs text-text-muted hover:text-accent-pink transition-colors">TikTok</a>
              <a href="https://x.com/stylaca" target="_blank" className="text-xs text-text-muted hover:text-accent-pink transition-colors">X (Twitter)</a>
            </div>

            <div className="footer-links flex flex-wrap gap-4 justify-center text-xs text-text-muted mt-2">
              <a href="/index.html" className="hover:text-accent-pink transition-colors">Home</a>
              <a href="/bridesmaid.html" className="hover:text-accent-pink transition-colors">Bridesmaid</a>
              <a href="/brands.html" className="hover:text-accent-pink transition-colors">For Fashion Brands</a>
              <a href="https://calendly.com/contact-styla/30min" target="_blank" className="hover:text-accent-pink transition-colors">Book a Demo</a>
              <a href="/tools/pricing-calculator.html" className="hover:text-accent-pink transition-colors">MOQ Price Calculator</a>
              <a href="/tools/size-chart-maker.html" className="hover:text-accent-pink transition-colors">AI Size Chart Maker</a>
              <a href="/blogs" className="hover:text-accent-pink transition-colors">Blogs</a>
              <a href="#" className="hover:text-accent-pink transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-accent-pink transition-colors">Terms of Service</a>
            </div>

            <p className="text-[10px] text-text-muted mt-4">&copy; 2026 STYLA Measure. All rights reserved.</p>
            <p className="text-[10px] text-accent-light italic mt-1">Your body. Your size. Everywhere.</p>
          </div>
        </div>
      </footer>

      {/* MOCK SCAN MODAL */}
      {scanModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card-bg border border-border-card rounded-3xl p-6 sm:p-8 max-w-md w-full relative flex flex-col gap-5 text-center">
            <button onClick={() => setScanModalOpen(false)} className="absolute top-4 right-5 text-text-muted hover:text-white text-2xl font-bold">&times;</button>
            <div>
              <span className="text-3xl">📏</span>
              <h3 className="font-serif text-2xl font-bold text-white mt-2">STYLA 3D Body Scanner</h3>
              <p className="text-xs text-text-muted mt-1.5 leading-relaxed font-sans">Get your exact measurements for a flawless fit in 30 seconds.</p>
            </div>
            <button 
              onClick={() => setScanModalOpen(false)}
              className="w-full bg-accent-pink hover:bg-accent-light text-white font-bold py-3 rounded-xl text-xs md:text-sm transition-colors btn-pink-glow"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
