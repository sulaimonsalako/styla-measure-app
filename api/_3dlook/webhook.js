import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { sendScanCompleteEmail } from '../_helpers/email-helper.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    console.log("Received 3DLook webhook payload:", JSON.stringify(req.body));

    // Extract person_id and client_id (or external_id) with support for nested person object
    const personObj = typeof req.body.person === 'object' ? req.body.person : null;
    
    let person_id = req.body.person_id || req.body.id;
    if (!person_id && personObj) {
      person_id = personObj.id;
    }
    if (!person_id && req.body.person && typeof req.body.person !== 'object') {
      person_id = req.body.person;
    }

    let username = req.body.client_id || req.body.external_id || req.body.email || req.body.customer_email || req.body.username || req.body.user_id;
    if (!username && personObj) {
      username = personObj.client_id || personObj.external_id || personObj.email || personObj.username;
    }

    if (!person_id) {
      return res.status(400).json({ error: 'Missing person_id in payload.' });
    }

    const apiKey = process.env.THREEDLOOK_API_KEY || process.env.TDLOOK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: '3DLook API Key not configured.' });
    }

    // Fetch details from 3DLook if not sent in the webhook payload directly
    let data = req.body.results || req.body.measurements || req.body.data;
    let heightCm = 170.0;
    
    if (!data || !data.volume_params) {
      console.log(`Fetching person ${person_id} measurements from SAIA MTM API...`);
      const response = await fetch('https://saia.3dlook.me/api/v2/persons/' + person_id + '/', {
        method: 'GET',
        headers: {
          'Authorization': 'APIKey ' + apiKey
        }
      });

      if (!response.ok) {
        const errData = await response.json();
        console.error("Failed to fetch from SAIA MTM API:", errData);
        return res.status(response.status).json({ error: errData });
      }
      data = await response.json();
    }

    const vp = data.volume_params || {};
    const fp = data.front_params || {};
    const sp = data.side_params || {};
    heightCm = data.height || 170.0;

    const scanData = {
      scan_id: 'scan_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      '3dlook_person_id': parseInt(person_id, 10),
      is_active: true,
      height: toInches(heightCm),
      volume_params: {
        chest: toInches(vp.chest || vp.bust || vp.bust_girth || vp.chest_girth),
        under_bust_girth: toInches(vp.under_bust_girth),
        upper_chest_girth: toInches(vp.upper_chest_girth),
        overarm_girth: toInches(vp.overarm_girth),
        waist: toInches(vp.waist || vp.waist_girth),
        high_hips: toInches(vp.high_hips || vp.upper_hip_girth || vp.high_hip_girth),
        low_hips: toInches(vp.low_hips || vp.hips || vp.hip_girth),
        waist_green: toInches(vp.waist_green),
        waist_gray: toInches(vp.waist_gray),
        pant_waist: toInches(vp.pant_waist),
        bicep: toInches(vp.bicep || vp.upper_arm_girth || vp.bicep_girth),
        upper_bicep_girth: toInches(vp.upper_bicep_girth),
        knee: toInches(vp.knee || vp.knee_girth),
        ankle: toInches(vp.ankle || vp.ankle_girth),
        wrist: toInches(vp.wrist || vp.wrist_girth),
        calf: toInches(vp.calf || vp.calf_girth),
        thigh: toInches(vp.thigh || vp.thigh_girth),
        thigh_1_inch_below_crotch: toInches(vp.thigh_1_inch_below_crotch),
        mid_thigh_girth: toInches(vp.mid_thigh_girth),
        neck: toInches(vp.neck || vp.neck_girth || vp.neck_base_girth),
        abdomen: toInches(vp.abdomen || vp.abdomen_girth),
        armscye_girth: toInches(vp.armscye_girth),
        neck_girth: toInches(vp.neck_girth || vp.neck_base_girth),
        neck_girth_relaxed: toInches(vp.neck_girth_relaxed),
        forearm: toInches(vp.forearm || vp.forearm_girth || vp.forearm_girth_flexed),
        elbow_girth: toInches(vp.elbow_girth || vp.elbow)
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

    const legacyTwin = {
      chest: scanData.volume_params.chest,
      waist: scanData.volume_params.waist,
      belly: scanData.volume_params.abdomen || scanData.volume_params.waist,
      hips: scanData.volume_params.low_hips,
      height: toInches(heightCm) || 64.0,
      shoulder: scanData.front_params.shoulders,
      sleeve: scanData.front_params.back_neck_point_to_wrist_length || ((scanData.front_params.sleeve_length && scanData.front_params.shoulders) ? (scanData.front_params.sleeve_length + (scanData.front_params.shoulders / 2)) : null),
      inseam: scanData.front_params.inseam_from_crotch_to_floor || scanData.front_params.inseam,
      neck: scanData.volume_params.neck,
      thigh: scanData.volume_params.thigh,
      bicep: scanData.volume_params.bicep,
      wrist: scanData.volume_params.wrist,
      length: scanData.front_params.new_jacket_length || 29.4
    };

    if (!username || username.toLowerCase() === 'guest') {
      console.log("Guest scan webhook completed. Skipping database write.");
      return res.status(200).json({
        success: true,
        message: 'Guest webhook processed successfully',
        twin: legacyTwin
      });
    }

    const cleanedUsername = username.trim().toLowerCase();

    if (supabase) {
      // A. Update public.profiles table (queried by portal measure.html / decoder.js)
      let portalQuery = supabase.from('profiles').select('api_scans, id, email');
      if (cleanedUsername.includes('@')) {
        portalQuery = portalQuery.eq('email', cleanedUsername);
      } else {
        portalQuery = portalQuery.eq('id', cleanedUsername);
      }
      
      const { data: userProfile } = await portalQuery.maybeSingle();
      
      if (userProfile) {
        const existingScans = userProfile.api_scans || [];
        existingScans.forEach(s => s.is_active = false);
        existingScans.push(scanData);
        
        const { error: profError } = await supabase
          .from('profiles')
          .update({
            chest: legacyTwin.chest,
            waist: legacyTwin.waist,
            belly: legacyTwin.belly,
            hips: legacyTwin.hips,
            height: legacyTwin.height,
            inseam: legacyTwin.inseam,
            shoulder: legacyTwin.shoulder,
            sleeve: legacyTwin.sleeve,
            neck: legacyTwin.neck,
            thigh: legacyTwin.thigh,
            bicep: legacyTwin.bicep,
            wrist: legacyTwin.wrist,
            api_scans: existingScans,
            updated_at: new Date().toISOString()
          })
          .eq('id', userProfile.id);

        if (profError) {
          console.error("Error updating public.profiles:", profError);
        } else {
          console.log(`Saved measurements for ${cleanedUsername} in public.profiles table via webhook.`);
        }
      }

      // B. Update store_profiles table (queried by e-commerce storefront app.js)
      const { data: existingStoreProf } = await supabase
        .from('store_profiles')
        .select('api_scans, password')
        .eq('username', cleanedUsername)
        .maybeSingle();

      const portalUrl = `https://${req.headers.host || 'styla-measure.vercel.app'}`;

      if (existingStoreProf) {
        const existingScans = existingStoreProf.api_scans || [];
        existingScans.forEach(s => s.is_active = false);
        existingScans.push(scanData);

        const { error: storeError } = await supabase
          .from('store_profiles')
          .update({
            twin: JSON.stringify(legacyTwin),
            api_scans: existingScans
          })
          .eq('username', cleanedUsername);
          
        if (storeError) {
          console.error("Error updating store_profiles:", storeError);
        } else {
          console.log(`Saved measurements for ${cleanedUsername} in store_profiles table via webhook.`);
          if (existingStoreProf.password === 'temp_guest_placeholder') {
            await sendScanCompleteEmail(cleanedUsername, legacyTwin, portalUrl);
          }
        }
      } else {
        // Insert guest profile placeholder
        const { error: insertError } = await supabase
          .from('store_profiles')
          .insert({
            username: cleanedUsername,
            password: 'temp_guest_placeholder',
            twin: JSON.stringify(legacyTwin),
            api_scans: [scanData],
            manual_measurements: {},
            measurement_overrides: {}
          });
        if (insertError) {
          console.error("Error inserting guest store_profile:", insertError);
        } else {
          console.log(`Created guest store_profile for ${cleanedUsername} in store_profiles via webhook.`);
          await sendScanCompleteEmail(cleanedUsername, legacyTwin, portalUrl);
        }
      }
    } else {
      const profilesPath = path.resolve(process.cwd(), 'profiles.json');
      const fileContent = fs.readFileSync(profilesPath, 'utf8');
      const profiles = JSON.parse(fileContent);

      let profile = profiles.find(p => 
        p.username.toLowerCase() === cleanedUsername || 
        (p.email && p.email.toLowerCase() === cleanedUsername)
      );
      const portalUrl = `https://${req.headers.host || 'styla-measure.vercel.app'}`;
      if (!profile) {
        // Create a guest placeholder profile in profiles.json
        profile = {
          username: cleanedUsername,
          email: cleanedUsername,
          password: 'temp_guest_placeholder',
          twin: legacyTwin,
          api_scans: [scanData],
          created_at: new Date().toISOString()
        };
        profiles.push(profile);
        console.log(`Created guest profile for ${cleanedUsername} in profiles.json via webhook.`);
        await sendScanCompleteEmail(cleanedUsername, legacyTwin, portalUrl);
      } else {
        const existingScans = profile.api_scans || [];
        existingScans.forEach(s => s.is_active = false);
        existingScans.push(scanData);

        profile.twin = legacyTwin;
        profile.api_scans = existingScans;
        console.log(`Saved measurements for ${cleanedUsername} in profiles.json via webhook.`);
        if (profile.password === 'temp_guest_placeholder') {
          await sendScanCompleteEmail(cleanedUsername, legacyTwin, portalUrl);
        }
      }

      fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2));
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
