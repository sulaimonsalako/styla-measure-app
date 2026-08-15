export function runSizingEngine(user, chart) {
  const chartType = chart.chart_type || 'body';
  const category = chart.garment_category || 'tops';
  const fabric = chart.fabric_type || 'woven';
  // A row with no name cannot be recommended -- a shopper can't pick "undefined".
  // These used to flow straight through into recommended_size and the explanation
  // string ("Size undefined fits you best"), so drop them up front.
  const sizes = (Array.isArray(chart.sizes) ? chart.sizes : [])
    .filter((s) => s && s.name != null && String(s.name).trim() !== '');
  const subclass = chart.garment_subclass || '';
  const structured = category === 'outerwear' || /suit|blazer|jacket|tailored/i.test(subclass + ' ' + category);

  if (sizes.length === 0) {
    // This return MUST carry the same keys as every other exit. It used to omit
    // `candidates`, `fit_facts`, `dimensions_compared` and — critically —
    // `insufficient_data`. The widget decides whether to show the honest
    // "can't size this" state from `insufficient_data` and from every candidate
    // having an empty breakdown; with no candidates and no flag, both checks
    // passed and the shopper was shown the literal size "Unknown" at 0% match
    // as though it were a recommendation.
    return {
      recommended_size: 'Unknown',
      fit_match_score: 0,
      dimensions_compared: 0,
      fit_spectrum: 'ideal',
      fit_breakdown: {},
      fit_facts: {},
      insufficient_data: true,
      candidates: [],
      explanation: 'No sizes found in chart.',
      warning: 'Size chart is empty.'
    };
  }

  // Define fabric tolerance values (inches)
  let stretchAllowance = 0.5; // default woven (rigid)
  if (fabric === 'knits') stretchAllowance = 1.5;
  else if (fabric === 'activewear') stretchAllowance = 3.0;

  let maxLooseness = 2.5; // default woven
  if (category === 'bottoms') maxLooseness = 1.5;
  else if (fabric === 'knits') maxLooseness = 4.0;
  else if (fabric === 'activewear') maxLooseness = 1.0;

  // Active API Scan check
  const activeScan = user.api_scans ? user.api_scans.find(s => s.is_active) : null;

  // Determine user dimensions using hierarchy: override > API scan > manual
  let userChest = parseFloat(user.chest || (user.twin && user.twin.chest));
  let userWaist = parseFloat(user.waist || (user.twin && user.twin.waist));
  let userBelly = parseFloat(user.belly || (user.twin && user.twin.belly) || userWaist);
  let userHips = parseFloat(user.hips || (user.twin && user.twin.hips));
  let userShoulder = parseFloat(user.shoulder || (user.twin && user.twin.shoulder));
  let userSleeve = parseFloat(user.sleeve || (user.twin && user.twin.sleeve));
  let userInseam = parseFloat(user.inseam || (user.twin && user.twin.inseam));
  let userThigh = parseFloat(user.thigh || (user.twin && user.twin.thigh));
  let userNeck = parseFloat(user.neck || (user.twin && user.twin.neck));
  // Torso length (neck point to waist) and rise. Only used when we actually have
  // them — we never invent a body measurement to make a chart column scoreable.
  let userTorso = parseFloat(user.torso || (user.twin && user.twin.torso));
  let userRise  = parseFloat(user.rise || (user.twin && user.twin.rise));

  if (activeScan) {
    userChest = parseFloat(activeScan.volume_params.chest) || userChest;
    userWaist = parseFloat(activeScan.volume_params.waist) || userWaist;
    userBelly = parseFloat(activeScan.volume_params.abdomen) || parseFloat(activeScan.volume_params.waist) || userBelly;
    userHips = parseFloat(activeScan.volume_params.low_hips) || userHips;
    userShoulder = parseFloat(activeScan.front_params.shoulders) || userShoulder;
    userSleeve = parseFloat(activeScan.front_params.back_neck_point_to_wrist_length) || 
                 (activeScan.front_params.sleeve_length ? (parseFloat(activeScan.front_params.sleeve_length) + (parseFloat(activeScan.front_params.shoulders || 0) / 2)) : null) || 
                 userSleeve;
    userInseam = parseFloat(activeScan.front_params.inseam_from_crotch_to_floor) || parseFloat(activeScan.front_params.inseam) || userInseam;
    userThigh = parseFloat(activeScan.volume_params.thigh) || userThigh;
    userNeck = parseFloat(activeScan.volume_params.neck) || userNeck;
    userTorso = parseFloat(activeScan.front_params.back_neck_point_to_waist) ||
                parseFloat(activeScan.front_params.neck_to_waist) || userTorso;
    userRise  = parseFloat(activeScan.front_params.rise) ||
                parseFloat(activeScan.front_params.crotch_height) || userRise;
  }

  if (user.measurement_overrides) {
    const overrides = user.measurement_overrides;
    if (overrides.chest) userChest = parseFloat(overrides.chest);
    if (overrides.waist) userWaist = parseFloat(overrides.waist);
    if (overrides.hips) userHips = parseFloat(overrides.hips);
    if (overrides.shoulder) userShoulder = parseFloat(overrides.shoulder);
    if (overrides.sleeve) userSleeve = parseFloat(overrides.sleeve);
    if (overrides.inseam) userInseam = parseFloat(overrides.inseam);
    if (overrides.thigh) userThigh = parseFloat(overrides.thigh);
    if (overrides.neck) userNeck = parseFloat(overrides.neck);
    if (overrides.torso) userTorso = parseFloat(overrides.torso);
    if (overrides.rise) userRise = parseFloat(overrides.rise);
  }

  // Sanitise the body before scoring. parseFloat happily yields Infinity from a
  // bad client payload, and Infinity is truthy, so it sailed past the
  // `if (!chartVal || !userVal) return;` guard and landed in fit_facts as
  // `ease: -Infinity` -- which the widget then rendered to the shopper.
  // A body measurement must be a finite positive number or it is simply absent.
  const clean = (v) => (Number.isFinite(v) && v > 0 ? v : NaN);
  userChest = clean(userChest); userWaist = clean(userWaist); userBelly = clean(userBelly);
  userHips = clean(userHips); userShoulder = clean(userShoulder); userSleeve = clean(userSleeve);
  userInseam = clean(userInseam); userThigh = clean(userThigh); userNeck = clean(userNeck);
  userTorso = clean(userTorso); userRise = clean(userRise);

  const candidateScores = [];

  for (const sizeObj of sizes) {
    const sizeName = sizeObj.name;
    
    const getVal = (prop) => {
      const v = sizeObj[prop];
      if (v === undefined || v === null) return null;
      if (Array.isArray(v)) {
        return (parseFloat(v[0]) + parseFloat(v[1])) / 2;
      }
      return parseFloat(v);
    };

    let chartChest = getVal('chest');
    let chartWaist = getVal('waist');
    let chartHips = getVal('hips');
    // Only score the belly when the chart genuinely publishes one. This used to
    // fall back to the waist column, so on an ordinary chest/waist/hips chart the
    // waist was scored TWICE (once as waist, once as belly) and midsection
    // deviation was penalised roughly double.
    let chartBelly = getVal('belly') || getVal('abdomen') || getVal('stomach');
    let chartShoulder = getVal('shoulder') || getVal('shoulder_width') || getVal('shoulders');
    let chartSleeve = getVal('sleeve') || getVal('sleeve_length');
    // Measurement-convention normalization for RAW charts (normalized charts are
    // already canonical — flagged _normalized — so skip to avoid double-applying).
    // Canonical: shoulder = full cross-back; sleeve = shoulder-to-wrist.
    if (!chart._normalized) {
      if (chartShoulder && chartShoulder < 11) chartShoulder = +(chartShoulder * 2).toFixed(2); // half -> full
      if (chartSleeve && chartSleeve >= 26.5) { // center-back-to-wrist -> shoulder-to-wrist
        chartSleeve = +(chartSleeve - (chartShoulder || 16) / 2 - 0.5).toFixed(2);
      }
    }
    let chartInseam = getVal('inseam');
    let chartThigh = getVal('thigh');
    // Garment length, rise and leg opening. `length` is the 4th most common
    // column merchants publish and was being dropped entirely.
    let chartLength = getVal('length') || getVal('body_length') || getVal('garment_length') || getVal('total_length');
    let chartRise   = getVal('rise') || getVal('rising_length') || getVal('front_rise');
    let chartLegOpen= getVal('leg_opening') || getVal('bottom_width') || getVal('hem');
    let chartNeck = getVal('neck') || getVal('collar') || getVal('neck_girth') || getVal('neck_girth_relaxed') || getVal('neck_base_girth');

    let score = 100;
    const breakdown = {};   // human prose (English) — kept for back-compat
    const facts = {};       // machine-readable, so clients can translate + convert units
    const scored = new Set();   // dimensions genuinely compared, for confidence
    let fits = true;
    let localSpectrum = 'ideal';

    const scoreDimension = (userVal, chartVal, label, critical = false) => {
      if (!chartVal || !userVal) return;

      // HARD vs ADJUSTABLE. A trouser waist that doesn't close is a returned
      // parcel; a thigh an inch off is a preference. `critical` was previously
      // accepted and then ignored, so every dimension carried equal weight —
      // this applies it to every deduction in this function.
      const W = critical ? 1.75 : 1;
      const pen = (amt) => { score -= amt * W; };
      scored.add(label);
      // Captured for the structured output: whether THIS dimension failed, and
      // the ideal ease it was judged against (only circumferences have one).
      let dimOk = true;
      let idealUsed = null;
      
      // Sleeve/shoulder are already reconciled to canonical (shoulder-to-wrist,
      // full cross-back) above, so compare user and chart directly here.
      let targetUserVal = userVal;

      // Calculate physical ease
      let physicalEase = 0;
      if (chartType === 'garment') {
        physicalEase = chartVal - targetUserVal;
      } else {
        // For body charts, estimate physical ease by adding typical brand ease
        let brandEase = 4.5; // default chest/hips tops
        if (label === 'chest') {
          brandEase = (category === 'outerwear') ? 5.5 : 4.5;
        } else if (label === 'waist') {
          brandEase = (category === 'bottoms') ? 1.0 : 4.0;
        } else if (label === 'belly') {
          brandEase = (category === 'bottoms') ? 1.5 : 4.0;
        } else if (label === 'hips') {
          brandEase = (category === 'bottoms') ? 3.5 : 4.0;
        } else if (label === 'shoulder' || label === 'sleeve' || label === 'inseam' || label === 'thigh'
                   || label === 'length' || label === 'rise') {
          brandEase = 0.8;
        }
        physicalEase = brandEase + (chartVal - targetUserVal);
      }

      // Evaluate fit based on label and physicalEase
      if (label === 'chest' || label === 'hips' || label === 'belly' || (label === 'waist' && category !== 'bottoms')) {
        // General circumferences (Chest, Bust, Belly, Hips, Waist on tops).
        // Ideal ease is CATEGORY-AWARE: structured garments (suits/jackets/outerwear)
        // need real drape ease; soft knit tops need very little. Score smoothly by how
        // far the ease is from that ideal, so sizes are genuinely discriminated and a
        // too-tight size is penalized instead of flattered as "slim fit".
        let ideal = 3.0;
        if (label === 'chest') ideal = structured ? 4.5 : (fabric === 'woven' ? 3.0 : 2.5);
        else if (label === 'hips') ideal = 3.5;
        else if (label === 'belly') ideal = structured ? 4.0 : 3.5;
        else if (label === 'waist') ideal = structured ? 3.5 : 3.0;

        if (physicalEase < -stretchAllowance) {
          fits = false; dimOk = false;
          pen(Math.abs(physicalEase + stretchAllowance) * 12);
          localSpectrum = 'slim';
          breakdown[label] = `Too tight (${Math.abs(physicalEase).toFixed(1)}" tighter than you need here)`;
        } else {
          const dev = physicalEase - ideal;
          pen(Math.abs(dev) * (dev < 0 ? 5 : 2)); // tighter-than-ideal penalized harder than looser
          if (dev < -1.0) localSpectrum = 'slim';
          else if (dev <= 1.5) localSpectrum = 'ideal';
          else if (dev <= 4.0) localSpectrum = 'relaxed';
          else localSpectrum = 'oversized';
          idealUsed = ideal;
          breakdown[label] = `${localSpectrum.charAt(0).toUpperCase() + localSpectrum.slice(1)} fit (${physicalEase.toFixed(1)}" ease · ideal ~${ideal}")`;
        }
      } else if (label === 'waist' && category === 'bottoms') {
        // Waist on bottoms (pants)
        if (physicalEase < -stretchAllowance) {
          fits = false; dimOk = false;
          pen(Math.abs(physicalEase + stretchAllowance) * 10);
          breakdown[label] = `Too tight (Garment waist is ${Math.abs(physicalEase).toFixed(1)}" smaller than your waist)`;
        } else if (physicalEase < 0) {
          pen(Math.abs(physicalEase) * 6);
          localSpectrum = 'slim';
          breakdown[label] = `Snug fit (${Math.abs(physicalEase).toFixed(1)}" under waist size)`;
        } else if (physicalEase <= 1.5) { // e.g. 0" to 1.5" ease
          localSpectrum = 'ideal';
          breakdown[label] = `Perfect fit (${physicalEase.toFixed(1)}" ease)`;
        } else if (physicalEase <= 3.0) { // e.g. 1.5" to 3.0" ease
          pen((physicalEase - 1.5) * 4);
          localSpectrum = 'relaxed';
          breakdown[label] = `Loose waist (${physicalEase.toFixed(1)}" ease)`;
        } else { // e.g. > 3.0" ease
          fits = false; dimOk = false; // falls off
          pen((physicalEase - 3.0) * 8);
          breakdown[label] = `Too loose (Garment is ${physicalEase.toFixed(1)}" larger than your waist)`;
        }
      } else if (label === 'sleeve') {
        // Sleeve length (adjusted for standard bent-elbow / mobility wearing ease of 0.5" to 3.0")
        if (physicalEase < 0) {
          fits = false; dimOk = false;
          pen(Math.abs(physicalEase) * 8);
          breakdown[label] = `Sleeves too short (Garment sleeve is ${Math.abs(physicalEase).toFixed(1)}" shorter than your arm)`;
        } else if (physicalEase < 0.5) {
          pen((0.5 - physicalEase) * 4);
          breakdown[label] = `Sleeves snug (Garment sleeve is ${physicalEase.toFixed(1)}" over arm length)`;
        } else if (physicalEase <= 3.0) { // 0.5" to 3.0" ease is ideal for movement/wearing ease
          localSpectrum = 'ideal';
          breakdown[label] = `Sleeves perfect (${physicalEase.toFixed(1)}" mobility allowance)`;
        } else if (physicalEase <= 4.5) { // 3.0" to 4.5" is relaxed
          pen((physicalEase - 3.0) * 2);
          localSpectrum = 'relaxed';
          breakdown[label] = `Sleeves long (${physicalEase.toFixed(1)}" ease)`;
        } else { // 4.5"+ is oversized
          pen((physicalEase - 4.5) * 5);
          localSpectrum = 'oversized';
          breakdown[label] = `Sleeves very long (${physicalEase.toFixed(1)}" ease)`;
        }
      } else if (label === 'neck') {
        // Neck/Collar (tightness can be worn open/unbuttoned, so fits remains true)
        if (physicalEase < 0.2) { // less than 0.2" ease is too tight to button comfortably
          pen(Math.abs(physicalEase - 0.2) * 5); // modest penalty
          breakdown[label] = `Tight collar (Garment collar is ${chartVal.toFixed(1)}" on a ${userVal.toFixed(1)}" neck)`;
        } else if (physicalEase <= 1.0) {
          localSpectrum = 'ideal';
          breakdown[label] = `Collar perfect (${physicalEase.toFixed(1)}" ease)`;
        } else {
          pen((physicalEase - 1.0) * 1.5);
          breakdown[label] = `Collar loose (${physicalEase.toFixed(1)}" ease)`;
        }
      } else if (label === 'length') {
        // Garment length vs torso. Unlike a circumference there is no "too big"
        // failure — a longer top is a style choice — so this nudges the score
        // rather than ruling a size out.
        if (physicalEase < -2.0) {
          pen(Math.abs(physicalEase + 2.0) * 3);
          breakdown[label] = `Cropped (${Math.abs(physicalEase).toFixed(1)}" shorter than your torso)`;
        } else if (physicalEase <= 3.0) {
          localSpectrum = 'ideal';
          breakdown[label] = `Length works (${physicalEase.toFixed(1)}" below your waist)`;
        } else {
          pen((physicalEase - 3.0) * 1.5);
          breakdown[label] = `Long on you (${physicalEase.toFixed(1)}" below your waist)`;
        }
      } else if (label === 'rise') {
        if (physicalEase < -1.0) {
          pen(Math.abs(physicalEase + 1.0) * 4);
          breakdown[label] = `Low rise (${Math.abs(physicalEase).toFixed(1)}" below your natural rise)`;
        } else if (physicalEase <= 1.5) {
          localSpectrum = 'ideal';
          breakdown[label] = `Rise sits right (${physicalEase.toFixed(1)}")`;
        } else {
          pen((physicalEase - 1.5) * 2);
          breakdown[label] = `High rise (${physicalEase.toFixed(1)}" above your natural rise)`;
        }
      } else if (label === 'inseam') {
        // Inseam length
        if (physicalEase < -2.0) {
          pen(Math.abs(physicalEase + 2.0) * 5);
          breakdown[label] = `Too short (Garment inseam is ${Math.abs(physicalEase).toFixed(1)}" shorter than your leg)`;
        } else if (physicalEase < 0) {
          pen(Math.abs(physicalEase) * 1);
          breakdown[label] = `Cropped fit (Inseam is ${Math.abs(physicalEase).toFixed(1)}" shorter)`;
        } else if (physicalEase <= 1.5) {
          localSpectrum = 'ideal';
          breakdown[label] = `Perfect length (${physicalEase.toFixed(1)}" break)`;
        } else {
          pen((physicalEase - 1.5) * 2.5);
          breakdown[label] = `Long inseam (Puddles by ${physicalEase.toFixed(1)}")`;
        }
      } else {
        // General length/shoulders/thighs
        if (physicalEase < -stretchAllowance) {
          fits = false; dimOk = false;
          pen(Math.abs(physicalEase + stretchAllowance) * 8);
          breakdown[label] = `Too narrow (Garment is ${Math.abs(physicalEase).toFixed(1)}" smaller)`;
        } else if (physicalEase < 0) {
          pen(Math.abs(physicalEase) * 2.5);
          localSpectrum = 'slim';
          breakdown[label] = `Snug fit (${Math.abs(physicalEase).toFixed(1)}" under target)`;
        } else if (physicalEase <= 1.5) {
          localSpectrum = 'ideal';
          breakdown[label] = `Perfect fit (${physicalEase.toFixed(1)}" ease)`;
        } else {
          pen((physicalEase - 1.5) * 1.5);
          localSpectrum = 'relaxed';
          breakdown[label] = `Relaxed fit (${physicalEase.toFixed(1)}" ease)`;
        }
      }

      facts[label] = {
        dim: label,
        verdict: localSpectrum,      // slim | ideal | relaxed | oversized
        ok: dimOk,                   // false = this dimension rules the size out
        ease: +physicalEase.toFixed(2),   // ALWAYS inches — the client converts
        ideal: idealUsed,
        critical: !!critical,
        text: breakdown[label],      // English fallback
      };
    };

    // Evaluate dimensions
    if (chartChest && userChest) scoreDimension(userChest, chartChest, 'chest');
    if (chartWaist && userWaist) scoreDimension(userWaist, chartWaist, 'waist', category === 'bottoms');
    if (chartBelly && userBelly) scoreDimension(userBelly, chartBelly, 'belly');
    if (chartHips && userHips) scoreDimension(userHips, chartHips, 'hips');
    if (chartShoulder && userShoulder) scoreDimension(userShoulder, chartShoulder, 'shoulder');
    if (chartSleeve && userSleeve) scoreDimension(userSleeve, chartSleeve, 'sleeve');
    if (chartInseam && userInseam) scoreDimension(userInseam, chartInseam, 'inseam', category === 'bottoms');
    if (chartThigh && userThigh) scoreDimension(userThigh, chartThigh, 'thigh');
    if (chartNeck && userNeck) scoreDimension(userNeck, chartNeck, 'neck');
    if (chartLength && userTorso) scoreDimension(userTorso, chartLength, 'length');
    if (chartRise && userRise) scoreDimension(userRise, chartRise, 'rise');

    // Published, but with no body measurement to judge them against. Report them
    // rather than silently discard: the shopper and the AI can both use a number
    // even when the engine can't score it. Deliberately does NOT touch `score`.
    const info = (key, val, text) => {
      breakdown[key] = text;
      facts[key] = { dim: key, verdict: 'info', ok: true, value: +val.toFixed(2), text };
    };
    if (chartLength && !userTorso) info('length', chartLength, `Garment length ${chartLength.toFixed(1)}"`);
    if (chartRise && !userRise) info('rise', chartRise, `Rise ${chartRise.toFixed(1)}"`);
    if (chartLegOpen) info('leg_opening', chartLegOpen, `Leg opening ${chartLegOpen.toFixed(1)}"`);

    const rawScore = score; // keep UNCLAMPED so failing sizes still rank by closeness
    score = Math.max(0, Math.min(100, Math.round(score)));

    candidateScores.push({
      name: sizeName,
      scoredCount: scored.size,
      facts,
      score,
      rawScore,
      fits,
      dims: Object.keys(breakdown).length,
      spectrum: localSpectrum,
      breakdown
    });
  }

  // Sort: sizes that fit first; then by RAW score. Ranking on raw (not the 0-clamped
  // value) means a body bigger than every size gets the LARGEST size (closest), not
  // the first one in the list — the clamp was making all failing sizes tie at 0.
  candidateScores.sort((a, b) => {
    if (a.fits && !b.fits) return -1;
    if (!a.fits && b.fits) return 1;
    return b.rawScore - a.rawScore;
  });

  const bestOption = candidateScores[0];

  // Coverage weighting: a "match" on a single dimension is not a real 100%.
  // Dampen confidence by how many body dimensions we could actually compare, so a
  // thin chest-only chart can't score 100% and brands we can fully assess rank higher.
  // NB: scoredCount, not breakdown.length — the breakdown also carries
  // informational rows (garment length, rise, leg opening) that we report but
  // cannot score, and those must not buy confidence.
  const comparedDims = bestOption.scoredCount || 0;
  const coverageFactor = Math.min(1, 0.55 + 0.15 * comparedDims); // 1 dim→0.70, 2→0.85, 3+→1.0
  const displayScore = Math.round(bestOption.score * coverageFactor);

  // Insufficient data: this chart shares NO comparable body dimension with the user
  // (e.g. a height-only or unit-mismatched chart). Don't present a confident size —
  // returning the first size to everyone is worse than admitting we can't size it.
  if (comparedDims === 0) {
    return {
      recommended_size: bestOption.name,
      fit_match_score: 0,
      dimensions_compared: 0,
      insufficient_data: true,
      fit_spectrum: bestOption.spectrum,
      fit_breakdown: {},
      fit_facts: {},
      explanation: 'This size chart doesn’t list the measurements we compare (it may size by height or use a format we can’t read yet), so we can’t confidently pick your size here.',
      warning: 'Not enough matching measurements on this chart to size you.',
      candidates: sizes.map((s) => ({ name: s.name, score: 0, spectrum: 'ideal', fits: false, breakdown: {}, facts: {} })),
    };
  }

  // Generate dynamic, reassuring styling explanations and alterations advice
  let explanation = `Size ${bestOption.name} is recommended as your best starting fit (${bestOption.spectrum}).`;
  let tailoringTips = [];
  
  if (bestOption.breakdown) {
    for (const [key, desc] of Object.entries(bestOption.breakdown)) {
      if (desc.includes("Loose waist") || desc.includes("ease") && key === 'waist') {
        const match = desc.match(/([0-9.]+)"/);
        if (match) {
          const val = parseFloat(match[1]);
          if (val >= 1.0) {
            tailoringTips.push(`**Waist Adjustment:** Expect approximately a ${val.toFixed(1)}" comfort gap at the waist. A tailor can easily take this in for a clean silhouette.`);
          }
        }
      }
      if (key === 'sleeve' && desc.includes("long")) {
        tailoringTips.push(`**Sleeve Length:** Sleeves run slightly long. Shortening hem is straightforward if you prefer showing more cuff.`);
      }
      if (key === 'neck' && desc.includes("Tight collar")) {
        // Find next larger size with fitting collar (neck ease >= 0.2)
        const currentSizeIdx = sizes.findIndex(s => s.name === bestOption.name);
        let sizeUpOption = null;
        if (currentSizeIdx !== -1) {
          for (let i = currentSizeIdx + 1; i < sizes.length; i++) {
            const nextSize = sizes[i];
            const nextNeckVal = nextSize.neck || nextSize.collar || nextSize.neck_girth || nextSize.neck_girth_relaxed || nextSize.neck_base_girth;
            if (nextNeckVal) {
              const nextNeckInches = Array.isArray(nextNeckVal) 
                ? (parseFloat(nextNeckVal[0]) + parseFloat(nextNeckVal[1])) / 2 
                : parseFloat(nextNeckVal);
              
              if (nextNeckInches - userNeck >= 0.2) {
                sizeUpOption = { name: nextSize.name, collar: nextNeckInches };
                break;
              }
            }
          }
        }
        
        if (sizeUpOption) {
          tailoringTips.push(`**Collar Fit / Sizing Up Advice:** The collar on Size ${bestOption.name} is too tight for your neck. If you require the collar to fit (e.g. to wear a tie), consider sizing up to Size ${sizeUpOption.name} (collar: ${sizeUpOption.collar.toFixed(1)}"). Note that the body of Size ${sizeUpOption.name} will fit significantly looser and may require professional taking-in. If you plan to wear the collar open/unbuttoned, Size ${bestOption.name} is your best fit.`);
        } else {
          tailoringTips.push(`**Collar Fit:** The collar is snug for buttoning. If you wear the shirt open/unbuttoned, it will fit your body perfectly.`);
        }
      }
      if (key === 'inseam' && desc.includes("Long")) {
        tailoringTips.push(`**Pant Length:** Hemming recommended. Shortening pant legs is simple and highly standard.`);
      }
    }
  }

  if (tailoringTips.length > 0) {
    explanation += `\n\n**🪡 Tailoring & Stylist Tips:**\n` + tailoringTips.map(t => `- ${t}`).join('\n');
  } else {
    explanation += `\n\n**✨ Stylist Tip:** Ready to wear! This item matches your target measurements with comfortable ease.`;
  }

  return {
    recommended_size: bestOption.name,
    fit_match_score: displayScore,
    dimensions_compared: comparedDims,
    fit_spectrum: bestOption.spectrum,
    fit_breakdown: bestOption.breakdown,   // English prose (back-compat)
    // Structured equivalent. Eases are ALWAYS in inches; the client formats and
    // converts. This is what lets the widget speak another language or show cm
    // without the server knowing either.
    fit_facts: bestOption.facts || {},
    explanation: explanation,
    warning: bestOption.fits ? null : `Warning: Size ${bestOption.name} may be a tight fit.`,
    // Every size, in chart order, so a widget can show "how each size fits you".
    candidates: sizes.map((s) => {
      const c = candidateScores.find((x) => x.name === s.name) || {};
      return { name: s.name, score: c.score ?? 0, spectrum: c.spectrum || 'ideal', fits: !!c.fits,
               breakdown: c.breakdown || {}, facts: c.facts || {} };
    }),
  };
}
