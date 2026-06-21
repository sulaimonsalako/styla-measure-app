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

  if (activeScan) {
    userChest = parseFloat(activeScan.volume_params.chest) || userChest;
    userWaist = parseFloat(activeScan.volume_params.waist) || userWaist;
    userBelly = parseFloat(activeScan.volume_params.abdomen) || parseFloat(activeScan.volume_params.waist) || userBelly;
    userHips = parseFloat(activeScan.volume_params.low_hips) || userHips;
    userShoulder = parseFloat(activeScan.front_params.shoulders) || userShoulder;
    userSleeve = parseFloat(activeScan.front_params.sleeve_length) || userSleeve;
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
    let chartBelly = getVal('belly') || chartWaist;
    let chartShoulder = getVal('shoulder') || getVal('shoulder_width') || getVal('shoulders');
    let chartSleeve = getVal('sleeve') || getVal('sleeve_length');
    let chartInseam = getVal('inseam');
    let chartThigh = getVal('thigh');

    // Finished garment dimensions ease conversion
    if (chartType === 'garment') {
      let designEaseChest = 2.0;
      let designEaseWaist = 1.0;
      let designEaseHips = 2.0;
      let designEaseShoulder = 1.0;
      let designEaseSleeve = 1.0;

      if (category === 'bottoms') {
        designEaseWaist = 0.5;
        designEaseHips = 1.5;
      } else if (category === 'outerwear') {
        designEaseChest = 3.5;
      }

      if (chartChest) chartChest = chartChest - designEaseChest;
      if (chartWaist) chartWaist = chartWaist - designEaseWaist;
      if (chartHips) chartHips = chartHips - designEaseHips;
      if (chartBelly) chartBelly = chartBelly - designEaseWaist;
      if (chartShoulder) chartShoulder = chartShoulder - designEaseShoulder;
      if (chartSleeve) chartSleeve = chartSleeve - designEaseSleeve;
    }

    let score = 100;
    const breakdown = {};
    let fits = true;
    let localSpectrum = 'ideal';

    const scoreDimension = (userVal, chartVal, label, critical = false) => {
      if (!chartVal || !userVal) return;
      const diff = chartVal - userVal; // positive = garment is larger than body

      if (diff < -stretchAllowance) {
        fits = false;
        score -= Math.abs(diff + stretchAllowance) * 20;
        breakdown[label] = `Too tight (Garment is ${Math.abs(diff).toFixed(1)}" smaller than your body)`;
      } else if (diff < 0) {
        score -= Math.abs(diff) * 10;
        localSpectrum = 'slim';
        breakdown[label] = `Slim fit (Tightness: ${Math.abs(diff).toFixed(1)}" under target)`;
      } else if (diff === 0) {
        breakdown[label] = 'Perfect fit';
      } else if (diff <= 1.5) {
        breakdown[label] = 'Comfortable fit';
      } else if (diff > maxLooseness) {
        if (critical) fits = false; // e.g. waist on bottoms falls off
        score -= Math.abs(diff - maxLooseness) * 10;
        localSpectrum = 'relaxed';
        breakdown[label] = `Very loose (Garment is ${diff.toFixed(1)}" larger than your body)`;
      } else {
        score -= (diff - 1.5) * 5;
        localSpectrum = 'relaxed';
        breakdown[label] = `Relaxed fit (Looseness: ${diff.toFixed(1)}" over target)`;
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
    fit_breakdown: bestOption.breakdown,
    explanation: `Size ${bestOption.name} is recommended based on your measurements. Fit is ${bestOption.spectrum}.`,
    warning: bestOption.fits ? null : `Warning: Size ${bestOption.name} may be a tight fit.`
  };
}
