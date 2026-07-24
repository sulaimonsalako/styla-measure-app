export function runSizingEngine(user, chart) {
  const chartType = chart.chart_type || 'body';
  const category = chart.garment_category || 'tops';
  const fabric = chart.fabric_type || 'woven';
  const sizes = chart.sizes || [];

  if (sizes.length === 0) {
    return {
      recommended_size: 'Unknown',
      fit_match_score: 0,
      fit_spectrum: 'ideal',
      fit_breakdown: {},
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
  }

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
    let chartBelly = getVal('belly') || (category !== 'bottoms' ? chartWaist : null);
    let chartShoulder = getVal('shoulder') || getVal('shoulder_width') || getVal('shoulders');
    let chartSleeve = getVal('sleeve') || getVal('sleeve_length');
    let chartInseam = getVal('inseam');
    let chartThigh = getVal('thigh');
    let chartNeck = getVal('neck') || getVal('collar') || getVal('neck_girth') || getVal('neck_girth_relaxed') || getVal('neck_base_girth');

    let score = 100;
    const breakdown = {};
    let fits = true;
    let localSpectrum = 'ideal';

    const scoreDimension = (userVal, chartVal, label, critical = false) => {
      if (!chartVal || !userVal) return;
      
      let targetUserVal = userVal;
      if (label === 'sleeve') {
        // Detect chart sleeve measurement type:
        // If chartVal is relatively small (typically < 26.5" for adults), it's shoulder-to-wrist.
        // Otherwise, it's center-back-to-wrist (neck-to-wrist).
        if (chartVal < 26.5) {
          const halfShoulder = (userShoulder || 16.0) / 2;
          targetUserVal = userVal - halfShoulder;
        }
      }

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
        } else if (label === 'shoulder' || label === 'sleeve' || label === 'inseam' || label === 'thigh') {
          brandEase = 0.8;
        }
        physicalEase = brandEase + (chartVal - targetUserVal);
      }

      // Evaluate fit based on label and physicalEase
      if (label === 'chest' || label === 'hips' || label === 'belly' || (label === 'waist' && category !== 'bottoms')) {
        // General circumferences (Chest, Bust, Belly, Hips, Waist on tops)
        if (physicalEase < -stretchAllowance) {
          fits = false;
          score -= Math.abs(physicalEase + stretchAllowance) * 10;
          breakdown[label] = `Too tight (Garment is ${Math.abs(physicalEase).toFixed(1)}" smaller than your body)`;
        } else if (physicalEase < 0) {
          score -= Math.abs(physicalEase) * 5;
          localSpectrum = 'slim';
          breakdown[label] = `Slim fit (Tightness: ${Math.abs(physicalEase).toFixed(1)}" under target)`;
        } else if (physicalEase <= 3.5) { // e.g. 0" to 3.5" ease
          if (fabric === 'woven') score -= (3.5 - physicalEase) * 1.5;
          localSpectrum = 'slim';
          breakdown[label] = `Fitted / Slim fit (${physicalEase.toFixed(1)}" ease)`;
        } else if (physicalEase <= 6.5) { // e.g. 3.5" to 6.5" ease (normal fit)
          localSpectrum = 'ideal';
          breakdown[label] = `Regular fit (${physicalEase.toFixed(1)}" ease)`;
        } else if (physicalEase <= 10.0) { // e.g. 6.5" to 10" ease
          score -= (physicalEase - 6.5) * 2;
          localSpectrum = 'relaxed';
          breakdown[label] = `Relaxed fit (${physicalEase.toFixed(1)}" ease)`;
        } else { // e.g. 10"+ ease
          score -= (physicalEase - 10.0) * 4;
          localSpectrum = 'oversized';
          breakdown[label] = `Oversized (${physicalEase.toFixed(1)}" ease)`;
        }
      } else if (label === 'waist' && category === 'bottoms') {
        // Waist on bottoms (pants)
        if (physicalEase < -stretchAllowance) {
          fits = false;
          score -= Math.abs(physicalEase + stretchAllowance) * 10;
          breakdown[label] = `Too tight (Garment waist is ${Math.abs(physicalEase).toFixed(1)}" smaller than your waist)`;
        } else if (physicalEase < 0) {
          score -= Math.abs(physicalEase) * 6;
          localSpectrum = 'slim';
          breakdown[label] = `Snug fit (${Math.abs(physicalEase).toFixed(1)}" under waist size)`;
        } else if (physicalEase <= 1.5) { // e.g. 0" to 1.5" ease
          localSpectrum = 'ideal';
          breakdown[label] = `Perfect fit (${physicalEase.toFixed(1)}" ease)`;
        } else if (physicalEase <= 3.0) { // e.g. 1.5" to 3.0" ease
          score -= (physicalEase - 1.5) * 4;
          localSpectrum = 'relaxed';
          breakdown[label] = `Loose waist (${physicalEase.toFixed(1)}" ease)`;
        } else { // e.g. > 3.0" ease
          fits = false; // falls off
          score -= (physicalEase - 3.0) * 8;
          breakdown[label] = `Too loose (Garment is ${physicalEase.toFixed(1)}" larger than your waist)`;
        }
      } else if (label === 'sleeve') {
        // Sleeve length (adjusted for standard bent-elbow / mobility wearing ease of 0.5" to 3.0")
        if (physicalEase < 0) {
          fits = false;
          score -= Math.abs(physicalEase) * 8;
          breakdown[label] = `Sleeves too short (Garment sleeve is ${Math.abs(physicalEase).toFixed(1)}" shorter than your arm)`;
        } else if (physicalEase < 0.5) {
          score -= (0.5 - physicalEase) * 4;
          breakdown[label] = `Sleeves snug (Garment sleeve is ${physicalEase.toFixed(1)}" over arm length)`;
        } else if (physicalEase <= 3.0) { // 0.5" to 3.0" ease is ideal for movement/wearing ease
          localSpectrum = 'ideal';
          breakdown[label] = `Sleeves perfect (${physicalEase.toFixed(1)}" mobility allowance)`;
        } else if (physicalEase <= 4.5) { // 3.0" to 4.5" is relaxed
          score -= (physicalEase - 3.0) * 2;
          localSpectrum = 'relaxed';
          breakdown[label] = `Sleeves long (${physicalEase.toFixed(1)}" ease)`;
        } else { // 4.5"+ is oversized
          score -= (physicalEase - 4.5) * 5;
          localSpectrum = 'oversized';
          breakdown[label] = `Sleeves very long (${physicalEase.toFixed(1)}" ease)`;
        }
      } else if (label === 'neck') {
        // Neck/Collar (tightness can be worn open/unbuttoned, so fits remains true)
        if (physicalEase < 0.2) { // less than 0.2" ease is too tight to button comfortably
          score -= Math.abs(physicalEase - 0.2) * 5; // modest penalty
          breakdown[label] = `Tight collar (Garment collar is ${chartVal.toFixed(1)}" on a ${userVal.toFixed(1)}" neck)`;
        } else if (physicalEase <= 1.0) {
          localSpectrum = 'ideal';
          breakdown[label] = `Collar perfect (${physicalEase.toFixed(1)}" ease)`;
        } else {
          score -= (physicalEase - 1.0) * 1.5;
          breakdown[label] = `Collar loose (${physicalEase.toFixed(1)}" ease)`;
        }
      } else if (label === 'inseam') {
        // Inseam length
        if (physicalEase < -2.0) {
          score -= Math.abs(physicalEase + 2.0) * 5;
          breakdown[label] = `Too short (Garment inseam is ${Math.abs(physicalEase).toFixed(1)}" shorter than your leg)`;
        } else if (physicalEase < 0) {
          score -= Math.abs(physicalEase) * 1;
          breakdown[label] = `Cropped fit (Inseam is ${Math.abs(physicalEase).toFixed(1)}" shorter)`;
        } else if (physicalEase <= 1.5) {
          localSpectrum = 'ideal';
          breakdown[label] = `Perfect length (${physicalEase.toFixed(1)}" break)`;
        } else {
          score -= (physicalEase - 1.5) * 2.5;
          breakdown[label] = `Long inseam (Puddles by ${physicalEase.toFixed(1)}")`;
        }
      } else {
        // General length/shoulders/thighs
        if (physicalEase < -stretchAllowance) {
          fits = false;
          score -= Math.abs(physicalEase + stretchAllowance) * 8;
          breakdown[label] = `Too narrow (Garment is ${Math.abs(physicalEase).toFixed(1)}" smaller)`;
        } else if (physicalEase < 0) {
          score -= Math.abs(physicalEase) * 2.5;
          localSpectrum = 'slim';
          breakdown[label] = `Snug fit (${Math.abs(physicalEase).toFixed(1)}" under target)`;
        } else if (physicalEase <= 1.5) {
          localSpectrum = 'ideal';
          breakdown[label] = `Perfect fit (${physicalEase.toFixed(1)}" ease)`;
        } else {
          score -= (physicalEase - 1.5) * 1.5;
          localSpectrum = 'relaxed';
          breakdown[label] = `Relaxed fit (${physicalEase.toFixed(1)}" ease)`;
        }
      }
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

    score = Math.max(0, Math.min(100, Math.round(score)));

    candidateScores.push({
      name: sizeName,
      score,
      fits,
      spectrum: localSpectrum,
      breakdown
    });
  }

  candidateScores.sort((a, b) => {
    if (a.fits && !b.fits) return -1;
    if (!a.fits && b.fits) return 1;
    return b.score - a.score;
  });

  const bestOption = candidateScores[0];

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
    fit_match_score: bestOption.score,
    fit_spectrum: bestOption.spectrum,
    fit_breakdown: bestOption.breakdown,
    explanation: explanation,
    warning: bestOption.fits ? null : `Warning: Size ${bestOption.name} may be a tight fit.`
  };
}
