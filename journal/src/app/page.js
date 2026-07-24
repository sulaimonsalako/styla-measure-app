"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { categories, articles, trending, colorTiles, bodyShapes, brandReviews, aiTools } from '../data/journalData';

export default function JournalHome() {
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

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [bookmarked, setBookmarked] = useState({});
  const [chatInput, setChatInput] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [stickyChatOpen, setStickyChatOpen] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanEmail, setScanEmail] = useState('');
  const [scanSubmitted, setScanSubmitted] = useState(false);

  // Filter articles based on search & category tab
  const filteredArticles = articles.filter(art => {
    const matchesSearch = art.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          art.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeTab === 'all' || art.category.includes(activeTab);
    return matchesSearch && matchesCategory;
  });

  // Toggle bookmark state
  const toggleBookmark = (slug) => {
    setBookmarked(prev => ({ ...prev, [slug]: !prev[slug] }));
  };

  // Handle chat prompt simulation
  const handleChatPrompt = (promptText) => {
    setIsChatLoading(true);
    setChatInput(promptText);
    setChatResponse('');
    
    setTimeout(() => {
      setIsChatLoading(false);
      let reply = "";
      if (promptText.toLowerCase().includes("size") && promptText.toLowerCase().includes("bridesmaid")) {
        reply = "Always order for your LARGEST measurement (typically Bust or Waist for formalwear). Bridals/bridesmaids dresses run 1 to 2 sizes smaller than retail street clothes. It is easy to take in a dress that is slightly loose, but letting it out is limited by tiny seam allowances.";
      } else if (promptText.toLowerCase().includes("neckline") || promptText.toLowerCase().includes("broad shoulders")) {
        reply = "For broad shoulders and a small waist, choose V-necks, halter necklines, or asymmetric one-shoulder silhouettes. These design lines guide the eye vertically rather than horizontally. Avoid boat necks or heavy cap sleeves.";
      } else if (promptText.toLowerCase().includes("champagne")) {
        reply = "Champagne satin dresses offer a stunning, minimalist luxury look. However, light champagne satin is highly unforgiving. We recommend selecting stretch satin fabrics and utilizing built-in linings to prevent seam pulling.";
      } else if (promptText.toLowerCase().includes("azazie") || promptText.toLowerCase().includes("revelry")) {
        reply = "Azazie offers free custom sizing (non-refundable), making it ideal for tall or petite bridesmaids. Revelry is known for high-quality heavy satin but runs small in waistbands. Revelry offers home try-on boxes, while Birdy Grey offers flat $99 options.";
      } else if (promptText.toLowerCase().includes("alter")) {
        reply = "Yes, but with caveats. Hemming length, shortening straps, and taking in the waist are easy (high confidence). Increasing the shoulders, letting out the chest, or widening armholes are extremely difficult or impossible. Always buy to fit your shoulders/chest first!";
      } else {
        reply = `That is an excellent question! Sizing charts show body measurements, not finished garments. To find your ideal fit for this concern, we recommend running a free 3D Body Scan on STYLA. Compare your dashboard specs against the brand guidelines for complete confidence.`;
      }
      setChatResponse(reply);
    }, 900);
  };

  const handleScanSubmit = (e) => {
    e.preventDefault();
    if (scanEmail.trim()) {
      setScanSubmitted(true);
      setTimeout(() => {
        const email = scanEmail.trim();
        setScanModalOpen(false);
        setScanSubmitted(false);
        setScanEmail('');
        window.location.href = `/index.html?scan_email=${encodeURIComponent(email)}`;
      }, 1500);
    }
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

      {/* HERO SECTION */}
      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="flex flex-col gap-6">
          <span className="text-xs uppercase tracking-widest text-accent-light font-bold">The STYLA Journal</span>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight text-white">
            Your AI Guide to<br />Finding the Perfect Fit.
          </h1>
          <p className="text-base md:text-lg text-text-muted max-w-lg leading-relaxed">
            Everything about bridesmaid dresses, custom suits, body measurements, alterations, wedding planning, and fashion sizing.
          </p>
          
          {/* Search bar */}
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                type="text" 
                placeholder="Search guides..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-text-muted outline-none focus:border-accent-light transition-all"
              />
              <button 
                onClick={() => handleChatPrompt(searchQuery || "What size bridesmaid dress should I buy?")}
                className="bg-gradient-to-r from-[#e11d48] to-accent-pink text-white font-bold px-6 py-3 rounded-xl btn-pink-glow shrink-0"
              >
                Ask STYLA AI
              </button>
            </div>
            {/* Search Suggestions */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-text-muted">Popular searches:</span>
              <button onClick={() => handleChatPrompt("Show me champagne dresses.")} className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-full py-1 px-3 transition-colors text-text-muted hover:text-white">🏷️ Satin Champagne Dresses</button>
              <button onClick={() => handleChatPrompt("Compare Azazie and Revelry sizing.")} className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-full py-1 px-3 transition-colors text-text-muted hover:text-white">🏷️ Sizing Comparison</button>
              <button onClick={() => handleChatPrompt("What size bridesmaid dress should I buy?")} className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-full py-1 px-3 transition-colors text-text-muted hover:text-white">🏷️ Bridesmaid Sizing</button>
            </div>
          </div>
        </div>

        {/* Editorial Photo Collage Mockup */}
        <div className="relative h-[320px] md:h-[400px] w-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-tr from-bg-dark/80 via-transparent to-transparent z-10"></div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80" 
            alt="Wedding fitting" 
            className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700" 
          />
          <div className="absolute bottom-6 left-6 z-20 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-accent-light uppercase tracking-wider">Editorial Spotlight</span>
            <span className="font-serif text-xl sm:text-2xl font-bold text-white">Sizing Certainty on Your Big Day</span>
          </div>
        </div>
      </header>

      {/* FEATURED CATEGORIES CARDS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-white/5">
        <h2 className="font-serif text-3xl font-bold mb-8 text-white">Featured Categories</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat) => (
            <div 
              key={cat.id} 
              onClick={() => setActiveTab(cat.id === activeTab ? 'all' : cat.title)}
              className={`p-6 rounded-2xl cursor-pointer card-luxury relative overflow-hidden group ${activeTab === cat.title ? 'border-accent-pink shadow-[0_0_15px_rgba(255,42,117,0.15)]' : ''}`}
            >
              <div className="relative z-10 flex flex-col gap-2">
                <span className="text-2xl">{cat.title.split(' ')[0]}</span>
                <h3 className="font-serif text-lg font-bold text-white group-hover:text-accent-light transition-colors">{cat.title.split(' ').slice(1).join(' ')}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{cat.desc}</p>
                <span className="text-[10px] text-accent-light font-bold uppercase mt-2">{cat.count} Guides Available</span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-tr from-accent-pink/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
          ))}
        </div>
      </section>

      {/* NETFLIX-STYLE ARTICLE CAROUSEL & TRENDING WEEK PANEL */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 overflow-hidden">
          <h2 className="font-serif text-3xl font-bold mb-8 text-white">Featured Articles</h2>
          <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar snap-x">
            {articles.map((art) => (
              <div 
                key={art.slug} 
                className="w-[280px] sm:w-[320px] shrink-0 snap-start bg-card-bg border border-border-card rounded-2xl overflow-hidden group card-luxury"
              >
                <div className="h-44 overflow-hidden relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={art.image} alt={art.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <span className="absolute top-3 left-3 bg-bg-dark/80 backdrop-blur-md text-[10px] font-bold text-accent-light py-1 px-2.5 rounded-full">{art.category}</span>
                </div>
                <div className="p-5 flex flex-col gap-3">
                  <h3 className="font-serif text-lg font-bold text-white line-clamp-2 leading-snug group-hover:text-accent-light transition-colors">{art.title}</h3>
                  <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">{art.description}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] text-text-muted">{art.readTime}</span>
                    <button 
                      onClick={() => toggleBookmark(art.slug)}
                      className="text-text-muted hover:text-accent-pink transition-colors"
                    >
                      <svg className={`w-4 h-4 ${bookmarked[art.slug] ? 'fill-accent-pink text-accent-pink' : 'text-text-muted'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trending Panel */}
        <div className="lg:col-span-1">
          <div className="bg-card-bg border border-border-card rounded-2xl p-6 h-full flex flex-col gap-6">
            <div>
              <h2 className="font-serif text-xl font-bold text-white">Trending This Week</h2>
              <p className="text-xs text-text-muted mt-1">What fits and colors are hot right now.</p>
            </div>
            <div className="flex flex-col gap-4">
              {trending.map((t, idx) => (
                <button 
                  key={idx} 
                  onClick={() => handleChatPrompt(t.title.replace('🔥 ', ''))}
                  className="flex items-center gap-3 text-left py-2 px-3 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/5 text-xs text-text-secondary hover:text-white transition-all"
                >
                  <span className="text-accent-pink font-bold text-sm">#0{idx+1}</span>
                  <span className="font-medium line-clamp-1">{t.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE AI ASSISTANT SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-gradient-to-br from-[#121222] to-bg-dark border border-[#ff2a75]/20 rounded-3xl p-6 md:p-10 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-accent-pink/5 rounded-full filter blur-[80px] pointer-events-none"></div>
          
          <div className="max-w-3xl mx-auto flex flex-col gap-6 relative z-10">
            <div className="text-center flex flex-col gap-2">
              <span className="text-xs font-bold text-accent-light uppercase tracking-wider">Interactive Fitting Room</span>
              <h2 className="font-serif text-3xl md:text-4xl font-extrabold text-white">Ask STYLA Anything</h2>
              <p className="text-xs md:text-sm text-text-muted">Chat with our AI sizing stylist for quick, tailor-grade answers.</p>
            </div>

            {/* Simulated Chat Interface */}
            <div className="bg-bg-dark/60 backdrop-blur-md border border-white/5 rounded-2xl p-5 min-h-[160px] flex flex-col gap-4">
              {chatInput && (
                <div className="self-end bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl rounded-br-none max-w-[85%] text-xs md:text-sm text-white">
                  {chatInput}
                </div>
              )}
              {isChatLoading ? (
                <div className="self-start flex items-center gap-2 bg-accent-pink/5 border border-accent-pink/10 px-4 py-3 rounded-xl rounded-bl-none text-xs md:text-sm text-accent-light">
                  <span className="w-1.5 h-1.5 bg-accent-pink rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-accent-pink rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-accent-pink rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  <span>STYLA is thinking...</span>
                </div>
              ) : chatResponse ? (
                <div className="self-start bg-accent-pink/5 border border-accent-pink/10 px-4 py-3.5 rounded-xl rounded-bl-none max-w-[85%] text-xs md:text-sm text-text-secondary leading-relaxed">
                  {chatResponse}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-text-muted italic">
                  Select a prompt below or type your question to start...
                </div>
              )}
            </div>

            {/* Input form */}
            <div className="flex gap-3">
              <input 
                type="text" 
                placeholder="What size bridesmaid dress should I buy?..." 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChatPrompt(chatInput)}
                className="flex-1 bg-bg-dark/50 border border-white/10 rounded-xl px-4 py-3 text-xs md:text-sm text-white placeholder-text-muted outline-none focus:border-accent-light transition-all"
              />
              <button 
                onClick={() => handleChatPrompt(chatInput || "What alterations will I need?")}
                className="bg-accent-pink hover:bg-accent-light text-white font-bold px-6 rounded-xl text-xs md:text-sm transition-all"
              >
                Send
              </button>
            </div>

            {/* Example prompts */}
            <div className="flex flex-col gap-2.5">
              <span className="text-xs text-text-muted font-bold">Suggested questions:</span>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => handleChatPrompt("What size bridesmaid dress should I buy?")} className="text-xs bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-full py-1.5 px-3.5 text-text-muted hover:text-white transition-all text-left">💡 What size bridesmaid dress should I buy?</button>
                <button onClick={() => handleChatPrompt("Which neckline suits broad shoulders?")} className="text-xs bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-full py-1.5 px-3.5 text-text-muted hover:text-white transition-all text-left">💡 Which neckline suits broad shoulders?</button>
                <button onClick={() => handleChatPrompt("Compare Azazie and Revelry sizing.")} className="text-xs bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-full py-1.5 px-3.5 text-text-muted hover:text-white transition-all text-left">💡 Compare Azazie and Revelry sizing.</button>
                <button onClick={() => handleChatPrompt("Can satin dresses be altered?")} className="text-xs bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-full py-1.5 px-3.5 text-text-muted hover:text-white transition-all text-left">💡 Can satin dresses be altered?</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* EXPLORE BY WEDDING COLOR */}
      <section id="colors" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-white/5">
        <div className="text-center mb-10 flex flex-col gap-2">
          <h2 className="font-serif text-3xl font-bold text-white">Explore by Wedding Color</h2>
          <p className="text-xs md:text-sm text-text-muted">Find matching sizing and styling guides across popular color swatches.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {colorTiles.map((color) => (
            <div 
              key={color.name}
              onClick={() => handleChatPrompt(`Show me ${color.name} dresses.`)}
              className="bg-card-bg border border-border-card rounded-2xl overflow-hidden group cursor-pointer card-luxury relative h-36 flex flex-col justify-end p-5 transition-all"
              style={{
                background: `linear-gradient(135deg, ${color.hex} 0%, rgba(18, 18, 34, 0.95) 100%)`,
                boxShadow: `inset 0 0 20px rgba(255, 255, 255, 0.05), 0 4px 15px rgba(0, 0, 0, 0.2)`
              }}
            >
              {/* Glossy satin fabric ripple overlay effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-30 group-hover:opacity-50 transition-opacity duration-300 pointer-events-none"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-bg-dark/90 via-transparent to-transparent z-10"></div>
              
              {/* Color Content */}
              <div className="relative z-20 flex flex-col">
                <span className="flex items-center gap-2 text-sm font-bold text-white">
                  <span className="w-3.5 h-3.5 rounded-full border border-white/30 shadow-[0_0_8px_rgba(255,255,255,0.2)]" style={{ backgroundColor: color.hex }}></span>
                  {color.name}
                </span>
                <span className="text-[11px] text-text-muted group-hover:text-accent-light transition-colors mt-1 font-semibold">{color.count} Guides &rarr;</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* EXPLORE BY BODY SHAPE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-white/5">
        <div className="text-center mb-10 flex flex-col gap-2">
          <h2 className="font-serif text-3xl font-bold text-white">Explore by Body Proportions</h2>
          <p className="text-xs md:text-sm text-text-muted">Get custom fit and design advice tailored to your exact frame.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {bodyShapes.map((shape) => (
            <div 
              key={shape.name}
              onClick={() => handleChatPrompt(`Give me fit advice for ${shape.name} body shape.`)}
              className="bg-card-bg border border-border-card rounded-2xl p-6 cursor-pointer card-luxury group relative overflow-hidden"
            >
              <div className="relative z-10 flex flex-col gap-2.5">
                <h3 className="font-serif text-lg font-bold text-white group-hover:text-accent-light transition-colors">{shape.name}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{shape.desc}</p>
                <p className="text-[11px] text-accent-light font-medium bg-accent-pink/5 border border-accent-pink/10 rounded-lg p-2.5 mt-2 leading-relaxed">
                  💡 {shape.advice}
                </p>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] via-transparent to-transparent"></div>
            </div>
          ))}
        </div>
      </section>

      {/* BRAND REVIEWS */}
      <section id="reviews" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-white/5">
        <div className="text-center mb-10 flex flex-col gap-2">
          <h2 className="font-serif text-3xl font-bold text-white">Premium Brand Reviews</h2>
          <p className="text-xs md:text-sm text-text-muted">Honest sizing comparisons and fit evaluations of top retail brands.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {brandReviews.map((brand) => (
            <div key={brand.id} className="bg-card-bg border border-border-card rounded-2xl p-6 flex flex-col justify-between card-luxury group">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <h3 className="font-serif text-xl font-bold text-white group-hover:text-accent-light transition-colors">{brand.name}</h3>
                  <span className="text-xs bg-[#ff2a75]/15 border border-[#ff2a75]/30 text-accent-light font-bold py-1 px-3 rounded-full">{brand.rating} Rating</span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{brand.desc}</p>
                <div className="flex flex-col gap-2 text-xs">
                  <div>
                    <span className="text-emerald-400 font-bold">✓ Pros: </span>
                    <span className="text-text-muted">{brand.pros}</span>
                  </div>
                  <div>
                    <span className="text-rose-400 font-bold">✗ Cons: </span>
                    <span className="text-text-muted">{brand.cons}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleChatPrompt(`Review the sizing for ${brand.name} in detail.`)}
                className="mt-6 w-full border border-white/10 hover:border-accent-pink/30 hover:bg-accent-pink/5 text-xs text-text-secondary hover:text-white font-bold py-2.5 rounded-xl transition-all"
              >
                Read Review
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* LATEST ARTICLES MASONRY LAYOUT */}
      <section id="articles" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-white/5">
        <h2 className="font-serif text-3xl font-bold mb-8 text-white">Latest Articles & Sizing Tips</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((art) => (
            <div key={art.slug} className="bg-card-bg border border-border-card rounded-2xl overflow-hidden group card-luxury flex flex-col justify-between">
              <div className="flex flex-col">
                <div className="h-48 overflow-hidden relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={art.image} alt={art.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <span className="absolute top-3 left-3 bg-bg-dark/80 backdrop-blur-md text-[10px] font-bold text-accent-light py-1 px-2.5 rounded-full">{art.category}</span>
                </div>
                <div className="p-6 flex flex-col gap-3">
                  <h3 className="font-serif text-lg font-bold text-white group-hover:text-accent-light transition-colors leading-snug">{art.title}</h3>
                  <p className="text-xs text-text-muted leading-relaxed line-clamp-3">{art.description}</p>
                </div>
              </div>
              
              <div className="p-6 pt-0 flex justify-between items-center border-t border-white/5 mt-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-white font-semibold">{art.author}</span>
                  <span className="text-[9px] text-text-muted mt-0.5">{art.date} &middot; {art.readTime}</span>
                </div>
                <button 
                  onClick={() => toggleBookmark(art.slug)}
                  className="text-text-muted hover:text-accent-pink transition-colors"
                >
                  <svg className={`w-4 h-4 ${bookmarked[art.slug] ? 'fill-accent-pink text-accent-pink' : 'text-text-muted'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* RELATED AI TOOLS DRIVING SIGNUPS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-white/5">
        <div className="text-center mb-10 flex flex-col gap-2">
          <h2 className="font-serif text-3xl font-bold text-white">Related Sizing AI Tools</h2>
          <p className="text-xs md:text-sm text-text-muted">Use STYLA sizing engines to automate fittings and convert sizing specs.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {aiTools.map((tool) => (
            <div key={tool.id} className="bg-card-bg border border-border-card rounded-2xl p-6 flex flex-col justify-between card-luxury group">
              <div className="flex flex-col gap-3">
                <h3 className="font-serif text-lg font-bold text-white group-hover:text-accent-light transition-colors">{tool.title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{tool.desc}</p>
              </div>
              <button 
                onClick={() => setScanModalOpen(true)}
                className="mt-6 w-full bg-white/5 group-hover:bg-accent-pink hover:bg-accent-light text-text-secondary group-hover:text-white font-bold py-2.5 rounded-xl text-xs transition-all border border-white/10 group-hover:border-transparent"
              >
                {tool.btn}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-card-bg to-bg-dark border border-white/5 rounded-3xl p-8 md:p-12 text-center max-w-4xl mx-auto relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-accent-pink/5 via-transparent to-transparent pointer-events-none"></div>
          <div className="max-w-2xl mx-auto flex flex-col gap-5 relative z-10">
            <h2 className="font-serif text-3xl md:text-4xl font-extrabold text-white">Never Guess Your Size Again.</h2>
            <p className="text-xs md:text-sm text-text-muted leading-relaxed">
              Receive weekly wedding inspiration, size guides, fashion trends, and AI shopping tips directly in your inbox.
            </p>
            <form onSubmit={handleScanSubmit} className="flex flex-col sm:flex-row gap-3 mt-2 max-w-lg mx-auto w-full">
              <input 
                type="email" 
                placeholder="Enter your email address" 
                required
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs md:text-sm text-white placeholder-text-muted outline-none focus:border-accent-light transition-all"
              />
              <button 
                type="submit"
                className="bg-accent-pink hover:bg-accent-light text-white font-bold px-6 py-3 rounded-xl text-xs md:text-sm transition-all btn-pink-glow"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </section>

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

      {/* STICKY AI ASSISTANT PANEL */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {stickyChatOpen && (
          <div className="bg-card-bg border border-[#ff2a75]/20 rounded-2xl p-4 w-[280px] sm:w-[320px] shadow-2xl flex flex-col gap-3 backdrop-blur-md animate-fade-in-up">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                STYLA Fit Assistant
              </span>
              <button onClick={() => setStickyChatOpen(false)} className="text-text-muted hover:text-white text-sm font-bold">&times;</button>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">Need help finding your correct size or matching color palettes? Ask our AI!</p>
            <button 
              onClick={() => {
                setStickyChatOpen(false);
                handleChatPrompt("What size bridesmaid dress should I buy?");
                const aiEl = document.getElementById("colors");
                if (aiEl) aiEl.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full bg-accent-pink hover:bg-accent-light text-white font-bold py-2 rounded-xl text-xs transition-colors text-center"
            >
              Ask STYLA AI &rarr;
            </button>
          </div>
        )}
        <button 
          onClick={() => setStickyChatOpen(!stickyChatOpen)}
          className="w-12 h-12 rounded-full bg-accent-pink flex items-center justify-center text-white shadow-2xl hover:scale-105 hover:bg-accent-light transition-all btn-pink-glow"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
      </div>

      {/* MOCK 3D SCANNER MODAL */}
      {scanModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card-bg border border-border-card rounded-3xl p-6 sm:p-8 max-w-md w-full relative flex flex-col gap-5 text-center animate-fade-in-up">
            <button onClick={() => setScanModalOpen(false)} className="absolute top-4 right-5 text-text-muted hover:text-white text-2xl font-bold">&times;</button>
            <div>
              <span className="text-3xl">📏</span>
              <h3 className="font-serif text-2xl font-bold text-white mt-2">STYLA 3D Body Scanner</h3>
              <p className="text-xs text-text-muted mt-1.5 leading-relaxed">Enter your email to receive your secure mobile scan credentials. No pictures are ever stored.</p>
            </div>
            {scanSubmitted ? (
              <div className="py-6 flex flex-col items-center gap-3">
                <span className="w-8 h-8 rounded-full border-2 border-accent-pink border-t-transparent animate-spin"></span>
                <span className="text-xs text-accent-light font-bold">Creating Secure Scan Session...</span>
              </div>
            ) : (
              <form onSubmit={handleScanSubmit} className="flex flex-col gap-4">
                <input 
                  type="email" 
                  placeholder="Enter your email address" 
                  required
                  value={scanEmail}
                  onChange={(e) => setScanEmail(e.target.value)}
                  className="bg-bg-dark/50 border border-white/10 rounded-xl px-4 py-3 text-xs md:text-sm text-white placeholder-text-muted outline-none focus:border-accent-light transition-all"
                />
                <button 
                  type="submit"
                  className="w-full bg-accent-pink hover:bg-accent-light text-white font-bold py-3 rounded-xl text-xs md:text-sm transition-colors btn-pink-glow"
                >
                  Generate Scan Code
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
