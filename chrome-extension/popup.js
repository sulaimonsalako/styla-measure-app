document.getElementById('analyze-btn').addEventListener('click', async () => {
  const chest = document.getElementById('chest').value;
  const waist = document.getElementById('waist').value;
  const resultDiv = document.getElementById('result');
  const btn = document.getElementById('analyze-btn');

  if (!chest || !waist) {
    alert("Please enter your measurements first.");
    return;
  }

  btn.textContent = "Analyzing Page...";
  btn.disabled = true;

  // In Phase 1, we simulate grabbing the page content/size chart.
  // We will connect this to our Vercel API next.
  setTimeout(() => {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = `<strong>✨ AI Recommendation:</strong><br/>
    Based on your Twin (Chest ${chest}", Waist ${waist}"), buy Size <strong>Medium</strong>.<br/><br/>
    <em>Fit: Perfect on the chest, slightly relaxed around the waist.</em>`;
    
    btn.textContent = "Analyze Fit on this Page";
    btn.disabled = false;
  }, 1500);
});
