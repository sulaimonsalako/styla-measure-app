export function runSizingEngine(user, chart) {
  const chartType = chart.chart_type || 'body';
  const category = chart.garment_category || 'tops';
  const subclass = chart.garment_subclass || 'other';
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

  // Determine stretch compensation factor based on fabric type and category/subclass
  let stretchFactor = 0.00;
  if (fabric === 'knits') {
    stretchFactor = 0.02;
  } else if (fabric === 'activewear') {
    stretchFactor = 0.07;
  } else if (fabric === 'compression') {
    stretchFactor = 0.10;
  }

  // Leggings / athletic subclasses can override
  if (subclass === 'leggings') {
    stretchFactor = Math.max(stretchFactor, 0.07);
  }

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
  }

  const candidateScores = [];

  const getRequiredEase = (label) => {
    if (label === 'chest') {
      if (subclass === 'blazer' || subclass === 'suit-jacket' || category === 'outerwear') return 4.0;
      if (subclass === 'dress-shirt' || subclass === 't-shirt') return 4.0;
      if (subclass === 'slim-shirt') return 2.0;
      if (subclass === 'hoodie') return 8.0;
      if (subclass === 'sweatshirt') return 6.0;
      if (subclass === 'blouse') return 3.0;
      if (subclass === 'bodycon') return 0.0;
      if (subclass === 'relaxed-dress') return 6.0;
      return (category === 'outerwear') ? 5.5 : 4.0;
    }
    if (label === 'waist' || label === 'belly') {
      if (category === 'bottoms') {
        if (subclass === 'jeans') return 0.0;
        if (subclass === 'tailored-trousers') return 0.5;
        if (subclass === 'leggings') return -2.0;
        return 1.0;
      }
      // Waist / Belly on tops
      if (subclass === 'blazer' || subclass === 'suit-jacket' || category === 'outerwear') return 3.0;
      if (subclass === 'dress-shirt') return 3.0;
      if (subclass === 'slim-shirt') return 1.0;
      if (subclass === 'hoodie') return 8.0;
      if (subclass === 'sweatshirt') return 4.0;
      if (subclass === 'blouse') return 2.5;
      if (subclass === 'bodycon') return -1.0;
      if (subclass === 'relaxed-dress') return 8.0;
      return 3.0;
    }
    if (label === 'hips') {
      if (category === 'bottoms') {
        if (subclass === 'jeans') return 3.0;
        if (subclass === 'tailored-trousers') return 2.0;
        if (subclass === 'leggings') return -3.0;
        return 3.5;
      }
      // Hips on tops
      if (subclass === 'blazer' || subclass === 'suit-jacket' || category === 'outerwear') return 2.0;
      if (subclass === 'dress-shirt') return 2.0;
      if (subclass === 'slim-shirt') return 1.0;
      if (subclass === 'hoodie') return 8.0;
      if (subclass === 'blouse') return 3.0;
      if (subclass === 'bodycon') return -1.0;
      if (subclass === 'relaxed-dress') return 6.0;
      return 3.0;
    }
    if (label === 'thigh') {
      if (subclass === 'leggings') return -2.0;
      return 1.5;
    }
    if (label === 'shoulder' || label === 'sleeve' || label === 'inseam') {
      return 0.8;
    }
    return 0.0;
  };

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

    let score = 100;
    const breakdown = {};
    let fits = true;
    let localSpectrum = 'ideal';

    const scoreDimension = (userVal, chartVal, label) => {
      if (!chartVal || !userVal) return;
      
      let targetUserVal = userVal;
      if (label === 'belly' && chartType === 'body') {
        // Anatomical offset: a user's belly is naturally ~1.5" larger than their natural waist spec
        targetUserVal = userVal - 1.5;
      }
      if (label === 'sleeve') {
        if (chartVal < 26.5) {
          const halfShoulder = (userShoulder || 16.0) / 2;
          targetUserVal = userVal - halfShoulder;
        }
      }

      if (label === 'sleeve') {
        const requiredSleeve = targetUserVal + 0.5;
        const diff = (chartType === 'garment') ? (chartVal - requiredSleeve) : (chartVal - targetUserVal);
        if (diff < 0) {
          fits = false;
          score -= Math.abs(diff) * 8 + 5;
          breakdown[label] = `Sleeves too short (Garment sleeve is ${Math.abs(diff).toFixed(1)}" shorter than required)`;
        } else if (diff < 0.5) {
          score -= (0.5 - diff) * 4;
          breakdown[label] = `Sleeves snug (Garment sleeve is ${diff.toFixed(1)}" over arm length)`;
        } else if (diff <= 2.0) {
          localSpectrum = 'ideal';
          breakdown[label] = `Sleeves perfect (${diff.toFixed(1)}" mobility allowance)`;
        } else if (diff <= 4.0) {
          score -= (diff - 2.0) * 2;
          localSpectrum = 'relaxed';
          breakdown[label] = `Sleeves long (${diff.toFixed(1)}" ease)`;
        } else {
          score -= (diff - 4.0) * 5;
          localSpectrum = 'oversized';
          breakdown[label] = `Sleeves very long (${diff.toFixed(1)}" ease)`;
        }
      } else if (label === 'inseam') {
        const requiredInseam = targetUserVal;
        const diff = (chartType === 'garment') ? (chartVal - requiredInseam) : (chartVal - targetUserVal);
        if (diff < -2.0) {
          fits = false;
          score -= Math.abs(diff + 2.0) * 5 + 5;
          breakdown[label] = `Too short (Garment inseam is ${Math.abs(diff).toFixed(1)}" shorter than your leg)`;
        } else if (diff < 0) {
          score -= Math.abs(diff) * 1;
          breakdown[label] = `Cropped fit (Inseam is ${Math.abs(diff).toFixed(1)}" shorter)`;
        } else if (diff <= 1.5) {
          localSpectrum = 'ideal';
          breakdown[label] = `Perfect length (${diff.toFixed(1)}" break)`;
        } else {
          score -= (diff - 1.5) * 2.5;
          breakdown[label] = `Long inseam (Puddles by ${diff.toFixed(1)}")`;
        }
      } else {
        const reqEase = getRequiredEase(label);
        const stretchComp = stretchFactor * targetUserVal;
        const diff = (chartType === 'garment') ? (chartVal - (targetUserVal + reqEase - stretchComp)) : (chartVal - targetUserVal);

        if (diff < -1.0) {
          fits = false;
          score -= Math.abs(diff + 1.0) * 12 + 10;
          breakdown[label] = `Too tight (Garment is ${Math.abs(diff).toFixed(1)}" smaller than required fit)`;
        } else if (diff < -0.25) {
          score -= Math.abs(diff) * 6;
          localSpectrum = 'slim';
          breakdown[label] = `Slim fit (Tightness: ${Math.abs(diff).toFixed(1)}" under target)`;
        } else if (diff <= 0.25) {
          localSpectrum = 'ideal';
          breakdown[label] = `Perfect fit (${diff >= 0 ? '+' : ''}${diff.toFixed(1)}" target offset)`;
        } else if (diff <= 1.0) {
          score -= (diff - 0.25) * 1.5;
          localSpectrum = 'ideal';
          breakdown[label] = `Good fit (${diff.toFixed(1)}" ease above target)`;
        } else if (diff <= 3.0) {
          score -= (diff - 1.0) * 3;
          localSpectrum = 'relaxed';
          breakdown[label] = `Loose fit (${diff.toFixed(1)}" ease above target)`;
        } else {
          score -= (diff - 3.0) * 6;
          localSpectrum = 'oversized';
          breakdown[label] = `Oversized (${diff.toFixed(1)}" ease above target)`;
        }
      }
    };

    if (chartChest && userChest) scoreDimension(userChest, chartChest, 'chest');
    if (chartWaist && userWaist) scoreDimension(userWaist, chartWaist, 'waist');
    if (chartBelly && userBelly) scoreDimension(userBelly, chartBelly, 'belly');
    if (chartHips && userHips) scoreDimension(userHips, chartHips, 'hips');
    if (chartShoulder && userShoulder) scoreDimension(userShoulder, chartShoulder, 'shoulder');
    if (chartSleeve && userSleeve) scoreDimension(userSleeve, chartSleeve, 'sleeve');
    if (chartInseam && userInseam) scoreDimension(userInseam, chartInseam, 'inseam');
    if (chartThigh && userThigh) scoreDimension(userThigh, chartThigh, 'thigh');

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

  return {
    recommended_size: bestOption.name,
    fit_match_score: bestOption.score,
    fit_spectrum: bestOption.spectrum,
    fit_breakdown: bestOption.fit_breakdown || bestOption.breakdown,
    explanation: `Size ${bestOption.name} is recommended based on your measurements. Fit is ${bestOption.spectrum}.`,
    warning: bestOption.fits ? null : `Warning: Size ${bestOption.name} may be a tight fit.`
  };
}
