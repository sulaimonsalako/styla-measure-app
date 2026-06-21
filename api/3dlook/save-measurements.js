import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
let supabase = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

function toInches(cmVal) {
  if (cmVal === undefined || cmVal === null) return null;
  return parseFloat((parseFloat(cmVal) / 2.54).toFixed(1));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { username, person_id, mock_id } = req.query;

    let scanData = null;
    let heightCm = 170.0;

    if (mock_id || !person_id) {
      scanData = {
        scan_id: 'scan_' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        '3dlook_person_id': 1111362,
        is_active: true,
        volume_params: {
          chest: 36.4,
          under_bust_girth: 33.4,
          upper_chest_girth: 37.8,
          overarm_girth: 46.6,
          waist: 30.8,
          high_hips: 31.1,
          low_hips: 37.9,
          waist_green: 32.0,
          waist_gray: 32.3,
          pant_waist: 32.0,
          bicep: 13.0,
          knee: 16.1,
          ankle: 10.7,
          wrist: 6.3,
          calf: 15.4,
          thigh: 26.0,
          abdomen: 32.1,
          neck: 15.3
        },
        front_params: {
          body_height: 64.0,
          outseam: 38.2,
          inseam: 26.4,
          shoulders: 16.2,
          sleeve_length: 21.2,
          new_jacket_length: 29.4
        },
        side_params: {}
      };
    } else {
      const apiKey = process.env.THREEDLOOK_API_KEY || process.env.TDLOOK_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: '3DLook API Key not configured.' });
      }

      const response = await fetch('https://saia.3dlook.me/api/v2/persons/' + person_id + '/', {
        method: 'GET',
        headers: {
          'Authorization': 'APIKey ' + apiKey
        }
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({ error: data });
      }

      const vp = data.volume_params || {};
      const fp = data.front_params || {};
      const sp = data.side_params || {};
      heightCm = data.height || 170.0;

      scanData = {
        scan_id: 'scan_' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        '3dlook_person_id': parseInt(person_id, 10),
        is_active: true,
        volume_params: {
          chest: toInches(vp.chest),
          under_bust_girth: toInches(vp.under_bust_girth),
          upper_chest_girth: toInches(vp.upper_chest_girth),
          overarm_girth: toInches(vp.overarm_girth),
          waist: toInches(vp.waist),
          high_hips: toInches(vp.high_hips),
          low_hips: toInches(vp.low_hips),
          waist_green: toInches(vp.waist_green),
          waist_gray: toInches(vp.waist_gray),
          pant_waist: toInches(vp.pant_waist),
          bicep: toInches(vp.bicep),
          upper_bicep_girth: toInches(vp.upper_bicep_girth),
          knee: toInches(vp.knee),
          ankle: toInches(vp.ankle),
          wrist: toInches(vp.wrist),
          calf: toInches(vp.calf),
          thigh: toInches(vp.thigh),
          thigh_1_inch_below_crotch: toInches(vp.thigh_1_inch_below_crotch),
          mid_thigh_girth: toInches(vp.mid_thigh_girth),
          neck: toInches(vp.neck),
          abdomen: toInches(vp.abdomen),
          armscye_girth: toInches(vp.armscye_girth),
          neck_girth: toInches(vp.neck_girth),
          neck_girth_relaxed: toInches(vp.neck_girth_relaxed),
          forearm: toInches(vp.forearm),
          elbow_girth: toInches(vp.elbow_girth)
        },
        front_params: {
          body_height: toInches(fp.body_height),
          outseam: toInches(fp.outseam),
          outseam_from_upper_hip_level: toInches(fp.outseam_from_upper_hip_level),
          inseam: toInches(fp.inseam),
          inside_leg_length_to_the_1_inch_above_the_floor: toInches(fp.inside_leg_length_to_the_1_inch_above_the_floor),
          crotch_length: toInches(fp.crotch_length),
          sleeve_length: toInches(fp.sleeve_length),
          underarm_length: toInches(fp.underarm_length),
          back_neck_point_to_wrist_length: toInches(fp.back_neck_point_to_wrist_length),
          back_neck_point_to_wrist_length_1_5_inch: toInches(fp.back_neck_point_to_wrist_length_1_5_inch),
          shoulders: toInches(fp.shoulders),
          chest_top: toInches(fp.chest_top),
          shoulder_length: toInches(fp.shoulder_length),
          shoulder_slope: fp.shoulder_slope,
          neck: toInches(fp.neck),
          waist_to_low_hips: toInches(fp.waist_to_low_hips),
          waist_to_knees: toInches(fp.waist_to_knees),
          abdomen_to_upper_knee_length: toInches(fp.abdomen_to_upper_knee_length),
          upper_knee_to_ankle: toInches(fp.upper_knee_to_ankle),
          nape_to_waist_centre_back: toInches(fp.nape_to_waist_centre_back),
          shoulder_to_waist: toInches(fp.shoulder_to_waist),
          side_neck_point_to_armpit: toInches(fp.side_neck_point_to_armpit),
          back_neck_height: toInches(fp.back_neck_height),
          bust_height: toInches(fp.bust_height),
          hip_height: toInches(fp.hip_height),
          upper_hip_height: toInches(fp.upper_hip_height),
          knee_height: toInches(fp.knee_height),
          outer_ankle_height: toInches(fp.outer_ankle_height),
          waist_height: toInches(fp.waist_height),
          leg_height: toInches(fp.leg_height),
          across_back_shoulder_width: toInches(fp.across_back_shoulder_width),
          across_back_width: toInches(fp.across_back_width),
          total_crotch_length: toInches(fp.total_crotch_length),
          neck_length: toInches(fp.neck_length),
          upper_arm_length: toInches(fp.upper_arm_length),
          lower_arm_length: toInches(fp.lower_arm_length),
          upper_hip_to_hip_length: toInches(fp.upper_hip_to_hip_length),
          back_shoulder_width: toInches(fp.back_shoulder_width),
          rise: toInches(fp.rise),
          back_neck_to_hip_length: toInches(fp.back_neck_to_hip_length),
          torso_height: toInches(fp.torso_height),
          front_crotch_length: toInches(fp.front_crotch_length),
          back_crotch_length: toInches(fp.back_crotch_length),
          inside_crotch_length_to_mid_thigh: toInches(fp.inside_crotch_length_to_mid_thigh),
          inside_crotch_length_to_knee: toInches(fp.inside_crotch_length_to_knee),
          inside_crotch_length_to_calf: toInches(fp.inside_crotch_length_to_calf),
          neck_to_waist_center_front: toInches(fp.neck_to_waist_center_front),
          neck_side_to_waist_back_length: toInches(fp.neck_side_to_waist_back_length),
          inseam_from_crotch_to_floor: toInches(fp.inseam_from_crotch_to_floor),
          inseam_from_crotch_to_ankle: toInches(fp.inseam_from_crotch_to_ankle),
          new_jacket_length: toInches(fp.new_jacket_length),
          side_neck_point_to_thigh: toInches(fp.side_neck_point_to_thigh)
        },
        side_params: {
          waist_depth: toInches(sp.waist_depth),
          side_upper_hip_level_to_knee: toInches(sp.side_upper_hip_level_to_knee),
          side_neck_point_to_upper_hip: toInches(sp.side_neck_point_to_upper_hip),
          neck_to_chest: toInches(sp.neck_to_chest),
          chest_to_waist: toInches(sp.chest_to_waist),
          waist_to_ankle: toInches(sp.waist_to_ankle),
          shoulders_to_knees: toInches(sp.shoulders_to_knees),
          axilla_to_waist_side_length: toInches(sp.axilla_to_waist_side_length)
        }
      };
    }

    const legacyTwin = {
      chest: scanData.volume_params.chest,
      waist: scanData.volume_params.waist,
      hips: scanData.volume_params.low_hips,
      height: toInches(heightCm) || 64.0,
      shoulder: scanData.front_params.shoulders,
      sleeve: scanData.front_params.sleeve_length,
      inseam: scanData.front_params.inseam,
      neck: scanData.volume_params.neck,
      thigh: scanData.volume_params.thigh,
      bicep: scanData.volume_params.bicep,
      wrist: scanData.volume_params.wrist,
      length: scanData.front_params.new_jacket_length || 29.4
    };

    if (!username || username.toLowerCase() === 'guest') {
      console.log("Guest scan completed. Skipping profile write.");
      return res.status(200).json({
        success: true,
        api_scans: [scanData],
        twin: legacyTwin
      });
    }

    const cleanedUsername = username.trim().toLowerCase();

    if (supabase) {
      const { data: existingProf } = await supabase
        .from('store_profiles')
        .select('api_scans')
        .eq('username', cleanedUsername)
        .maybeSingle();

      const existingScans = existingProf?.api_scans || [];
      existingScans.forEach(s => s.is_active = false);
      existingScans.push(scanData);

      const { error } = await supabase
        .from('store_profiles')
        .update({
          twin: JSON.stringify(legacyTwin),
          api_scans: existingScans
        })
        .eq('username', cleanedUsername);

      if (error) throw error;

      return res.status(200).json({
        success: true,
        api_scans: existingScans,
        twin: legacyTwin
      });
    } else {
      const profilesPath = path.resolve(process.cwd(), 'profiles.json');
      const fileContent = fs.readFileSync(profilesPath, 'utf8');
      const profiles = JSON.parse(fileContent);

      const profile = profiles.find(p => p.username.toLowerCase() === cleanedUsername);
      if (!profile) {
        return res.status(404).json({ error: 'User profile not found.' });
      }

      const existingScans = profile.api_scans || [];
      existingScans.forEach(s => s.is_active = false);
      existingScans.push(scanData);

      profile.twin = legacyTwin;
      profile.api_scans = existingScans;

      fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2));

      return res.status(200).json({
        success: true,
        api_scans: existingScans,
        twin: legacyTwin
      });
    }

  } catch (error) {
    console.error('3DLook save-measurements error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}