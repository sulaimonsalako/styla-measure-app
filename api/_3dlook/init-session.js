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
    const { gender, height, weight, front_image, side_image } = req.body;

    if (!gender || !height || !weight) {
      return res.status(400).json({ error: 'Missing required parameters (gender, height, weight).' });
    }

    const apiKey = process.env.THREEDLOOK_API_KEY || process.env.TDLOOK_API_KEY;

    if (!apiKey) {
      console.log('No THREEDLOOK_API_KEY found, returning mock session.');
      return res.status(200).json({
        id: 1111362,
        url: 'https://saia.3dlook.me/api/v2/persons/1111362/?measurements_type=all',
        gender: gender,
        height: height,
        weight: weight,
        mock: true,
        task_set_url: '/api/3dlook/check-status?mock_id=1111362&gender=' + gender + '&height=' + height + '&weight=' + weight
      });
    }

    // Actual API Call
    const requestBody = {
      gender,
      height: parseInt(height, 10),
      weight: parseFloat(weight)
    };
    if (front_image) requestBody.front_image = front_image.replace(/^data:image\/\w+;base64,/, "");
    if (side_image) requestBody.side_image = side_image.replace(/^data:image\/\w+;base64,/, "");

    const response = await fetch('https://saia.3dlook.me/api/v2/persons/?measurements_type=all', {
      method: 'POST',
      headers: {
        'Authorization': 'APIKey ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('3DLook init-session error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}