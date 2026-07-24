<script>
    // Bind B2C Manual Save Gate button to open signup modal
    document.addEventListener('DOMContentLoaded', () => {
      const manualSaveGateBtn = document.getElementById('btn-manual-save-gate');
      if (manualSaveGateBtn) {
        manualSaveGateBtn.addEventListener('click', () => {
          const chest = document.getElementById('val-chest').value;
          const waist = document.getElementById('val-waist').value;
          const hips = document.getElementById('val-hips').value;
          if (!chest || !waist || !hips) {
            alert("Please fill in your Chest, Waist, and Hips before saving.");
            return;
          }

          // Save manual measurements to localStorage so signup parses them immediately
          localStorage.setItem('styla_twin_chest', chest);
          localStorage.setItem('styla_twin_waist', waist);
          const belly = document.getElementById('val-belly').value;
          if (belly) localStorage.setItem('styla_twin_belly', belly);
          localStorage.setItem('styla_twin_hips', hips);
          const inseam = document.getElementById('val-inseam').value;
          if (inseam) localStorage.setItem('styla_twin_inseam', inseam);

          const heightFt = document.getElementById('val-height-ft').value;
          const heightIn = document.getElementById('val-height-in').value;
          if (heightFt !== "" && heightIn !== "") {
            const totalHeight = (parseInt(heightFt, 10) * 12) + parseInt(heightIn, 10);
            localStorage.setItem('styla_twin_height', totalHeight.toString());
          }

          // Open login modal and focus on signup tab
          const loginModal = document.getElementById('login-modal');
          if (loginModal) {
            loginModal.style.display = 'flex';
            const signupTabBtn = document.getElementById('tab-auth-signup');
            if (signupTabBtn) {
              signupTabBtn.click();
            }
          }
        });
      }
    });

    // 16-Hour Coordinated Countdown Timer
    function startSixteenHourTimer() {
        let deadline = localStorage.getItem('styla_countdown_timer');
        if (!deadline) {
            deadline = new Date().getTime() + (16 * 60 * 60 * 1000); // Strict 16 Hours
            localStorage.setItem('styla_countdown_timer', deadline);
        }
        setInterval(function() {
            let now = new Date().getTime();
            let distance = deadline - now;
            if (distance < 0) {
                deadline = new Date().getTime() + (16 * 60 * 60 * 1000); // Smooth Reset Loop
                localStorage.setItem('styla_countdown_timer', deadline);
                distance = deadline - now;
            }
            let hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            let minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            let seconds = Math.floor((distance % (1000 * 60)) / 1000);
            
            let displayTarget = document.getElementById("styla-urgency-clock");
            if(displayTarget) {
                displayTarget.innerHTML = "[ " + (hours < 10 ? "0" : "") + hours + ":" + 
                                          (minutes < 10 ? "0" : "") + minutes + ":" + 
                                          (seconds < 10 ? "0" : "") + seconds + " ]";
            }
        }, 1000);
    }
    startSixteenHourTimer();

  </script>

</body>
</html>