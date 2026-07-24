"use client";

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { articles } from '../../../data/journalData';

export default function ArticleDetail({
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
  const slug = resolvedParams.slug;
  const article = articles.find(art => art.slug === slug);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [chatResponse, setChatResponse] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [scanModalOpen, setScanModalOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        const scrolled = (window.scrollY / totalScroll) * 100;
        setScrollProgress(scrolled);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!article) {
    return (
      <div className="min-h-screen bg-bg-dark text-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="font-serif text-3xl font-bold mb-4">Article Not Found</h1>
        <p className="text-text-muted mb-6">The sizing guide you are looking for does not exist or has been moved.</p>
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
      let reply = `Based on the details in "${article.title}", we recommend prioritizing structural fit (like shoulder and chest measurements) above cosmetic choices. For custom sizing or to compare body dimensions directly, running a free STYLA 3D Scan is highly recommended.`;
      setChatResponse(reply);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-bg-dark text-text-white relative font-sans">
      
      {/* READING PROGRESS BAR */}
      <div 
        className="fixed top-0 left-0 h-1 bg-accent-pink z-50 transition-all duration-100"
        style={{ width: `${scrollProgress}%` }}
      ></div>

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

      {/* ARTICLE LAYOUT */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* Main Content */}
        <main className="lg:col-span-2 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase font-bold text-accent-light tracking-wider">{article.category}</span>
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight">
              {article.title}
            </h1>
            <div className="flex items-center gap-4 text-xs text-text-muted mt-2 border-b border-white/5 pb-6">
              <span>By <strong>{article.author}</strong></span>
              <span>&bull;</span>
              <span>{article.date}</span>
              <span>&bull;</span>
              <span>{article.readTime}</span>
            </div>
          </div>

          {/* Hero Image */}
          <div className="h-64 sm:h-[400px] w-full rounded-2xl overflow-hidden border border-white/10 shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={article.image} alt={article.title} className="w-full h-full object-cover" />
          </div>

          {/* Body content */}
          <div className="article-body flex flex-col gap-6 font-sans text-sm sm:text-base text-text-secondary leading-relaxed mt-4">
            {article.content.map((sec, idx) => {
              if (sec.type === 'heading') {
                return <h2 key={idx} className="font-serif text-2xl font-bold text-white mt-6 border-b border-white/5 pb-2">{sec.text}</h2>;
              }
              return <p key={idx}>{sec.text}</p>;
            })}
          </div>
        </main>

        {/* Sidebar Widgets */}
        <aside className="lg:col-span-1 flex flex-col gap-8">
          
          {/* Ask AI Widget */}
          <div className="bg-card-bg border border-[#ff2a75]/25 rounded-2xl p-6 shadow-xl flex flex-col gap-4 sticky top-24">
            <div>
              <span className="text-xs font-bold text-accent-light uppercase tracking-wider">AI Sizing Stylist</span>
              <h3 className="font-serif text-lg font-bold text-white mt-1">Ask STYLA About This Guide</h3>
            </div>
            
            {chatResponse ? (
              <div className="bg-bg-dark/80 border border-white/5 p-3 rounded-xl text-xs text-text-muted leading-relaxed">
                {chatResponse}
              </div>
            ) : (
              <p className="text-xs text-text-muted leading-relaxed">
                Have specific concerns about this sizing guide or fitting calculations? Ask STYLA AI directly.
              </p>
            )}

            <div className="flex flex-col gap-2">
              <input 
                type="text" 
                placeholder="Ask about this article..." 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && askAI(chatInput)}
                className="bg-bg-dark/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-text-muted outline-none focus:border-accent-light"
              />
              <button 
                onClick={() => askAI(chatInput || "What is the key takeaway?")}
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
