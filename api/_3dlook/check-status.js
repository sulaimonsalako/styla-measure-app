export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { mock_id, queue_url, gender, height, weight } = req.query;

    if (mock_id || !queue_url) {
      // Mock flow
      return res.status(200).json({
        is_ready: true,
        is_successful: true,
        person_id: 1111362,
        mock: true,
        redirect_to: '/api/3dlook/save-measurements?mock_id=1111362&gender=' + (gender || '') + '&height=' + (height || '') + '&weight=' + (weight || '')
      });
    }

    const apiKey = process.env.THREEDLOOK_API_KEY || process.env.TDLOOK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: '3DLook API Key not configured.' });
    }

    const response = await fetch(queue_url, {
      method: 'GET',
      headers: {
        'Authorization': 'APIKey ' + apiKey
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    // 3DLook returns is_ready, is_successful, and results or error details.
    // If successful and ready, redirect to save-measurements
    let redirectTo = null;
    if (data.is_ready && data.is_successful) {
      const personId = data.results.person.id || data.results.person.url.split('/').filter(Boolean).pop();
      redirectTo = '/api/3dlook/save-measurements?person_id=' + personId;
    }

    return res.status(200).json({
      is_ready: data.is_ready,
      is_successful: data.is_successful,
      errors: data.errors,
      redirect_to: redirectTo
    });

  } catch (error) {
    console.error('3DLook check-status error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}