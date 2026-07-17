document.addEventListener('DOMContentLoaded', () => {
  const containers = document.querySelectorAll('.styla-widget-container');
  
  containers.forEach(container => {
    const productId = container.getAttribute('data-product-id');
    const productTitle = container.getAttribute('data-product-title');
    const productHandle = container.getAttribute('data-product-handle');
    const customerId = container.getAttribute('data-customer-id');
    const blockId = container.id.replace('styla-widget-', '');
    
    // Core Elements
    const triggerBtn = document.getElementById(`styla-trigger-btn-${blockId}`);
    const modal = document.getElementById(`styla-modal-${blockId}`);
    const closeBtn = document.getElementById(`styla-close-${blockId}`);
    const bestSizeValEl = document.getElementById(`styla-best-size-val-${blockId}`);
    const intentTextEl = document.getElementById(`styla-intent-text-${blockId}`);
    
    // Edit Form Elements
    const editBtn = document.getElementById(`styla-edit-specs-${blockId}`);
    const cancelFormBtn = document.getElementById(`styla-cancel-specs-${blockId}`);
    const saveFormBtn = document.getElementById(`styla-save-specs-${blockId}`);
    const formPanel = document.getElementById(`styla-form-${blockId}`);
    const detailsBody = document.getElementById(`styla-details-body-${blockId}`);
    
    // Form Inputs
    const inShoulders = document.getElementById(`styla-in-shoulders-${blockId}`);
    const inChest = document.getElementById(`styla-in-chest-${blockId}`);
    const inWaist = document.getElementById(`styla-in-waist-${blockId}`);
    
    // Size Slider Clicks
    const sizeBtns = modal.querySelectorAll('.styla-size-opt-btn');
    const prevBtn = document.getElementById(`styla-prev-size-${blockId}`);
    const nextBtn = document.getElementById(`styla-next-size-${blockId}`);
    
    // Tabs & Chat
    const tabs = modal.querySelectorAll('.styla-tab-btn');
    const tabContents = modal.querySelectorAll('.styla-tab-content');
    const chatHistory = document.getElementById(`styla-chat-history-${blockId}`);
    const chatInput = document.getElementById(`styla-chat-input-${blockId}`);
    const chatSend = document.getElementById(`styla-chat-send-${blockId}`);
    
    // Default size data
    const sizeData = {
      'S': {
        size: 'S',
        intent: 'Size S would fit too tight in the chest (-0.5" ease). Recommended to size up for the designer\'s intended fit.',
        measurements: [
          { label: 'Shoulders', ease: '-0.2" ease', badge: 'Slightly tight', status: 'warn' },
          { label: 'Chest', ease: '-0.5" ease', badge: 'Tight', status: 'err' },
          { label: 'Waist', ease: '+0.4" ease', badge: 'Ideal', status: 'ok' }
        ]
      },
      'M': {
        size: 'M',
        intent: 'Designed as a "Relaxed Fit" tee. Size M is the recommended fit because the chest fits comfortably (+3.5" ease).',
        measurements: [
          { label: 'Shoulders', ease: '+0.2" ease', badge: 'Ideal', status: 'ok' },
          { label: 'Chest', ease: '+3.5" ease', badge: 'Ideal', status: 'ok' },
          { label: 'Waist', ease: '+2.8" ease', badge: 'Slightly loose', status: 'warn' }
        ]
      },
      'L': {
        size: 'L',
        intent: 'Size L will look intentionally oversized (+6.0" chest ease). Great if you prefer a very baggy fit.',
        measurements: [
          { label: 'Shoulders', ease: '+1.5" ease', badge: 'Slightly loose', status: 'warn' },
          { label: 'Chest', ease: '+6.0" ease', badge: 'Slightly loose', status: 'warn' },
          { label: 'Waist', ease: '+5.2" ease', badge: 'Oversized', status: 'warn' }
        ]
      }
    };

    // Product Size Chart specs (T-shirt defaults)
    const sizeChart = {
      'S': { shoulders: 16.0, chest: 36.0, waist: 32.0 },
      'M': { shoulders: 17.5, chest: 40.0, waist: 36.0 },
      'L': { shoulders: 19.0, chest: 44.0, waist: 40.0 }
    };

    let activeSizeIndex = 1; // Default to 'M'
    const sizesArray = ['S', 'M', 'L'];
    let userRecommendedSize = 'M';

    // Trigger Button Click -> Open Modal
    triggerBtn.addEventListener('click', () => {
      modal.classList.remove('styla-hidden');
      document.body.style.overflow = 'hidden';
      updateSizeDetails(userRecommendedSize);
    });

    // Close Modal
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    function closeModal() {
      modal.classList.add('styla-hidden');
      document.body.style.overflow = '';
      hideEditForm();
    }

    // Tab Switching
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-tab');
        modal.querySelector(`#${targetId}`).classList.add('active');
      });
    });

    // Toggle Edit Form
    editBtn.addEventListener('click', showEditForm);
    cancelFormBtn.addEventListener('click', hideEditForm);

    function showEditForm() {
      detailsBody.classList.add('styla-hidden');
      formPanel.classList.remove('styla-hidden');
    }

    function hideEditForm() {
      formPanel.classList.add('styla-hidden');
      detailsBody.classList.remove('styla-hidden');
    }

    // Save Form & Run Sizing Engine Calculations (Styla Fit Engine specification)
    saveFormBtn.addEventListener('click', () => {
      const sBody = parseFloat(inShoulders.value) || 17.0;
      const cBody = parseFloat(inChest.value) || 36.0;
      const wBody = parseFloat(inWaist.value) || 31.0;

      // Evaluate each size
      sizesArray.forEach(sz => {
        const specs = sizeChart[sz];
        const diffShoulders = specs.shoulders - sBody;
        const diffChest = specs.chest - cBody;
        const diffWaist = specs.waist - wBody;

        // Calculate badges and status based on Formula 4 Fit Score
        const shEval = getFitScore(diffShoulders, 0.0); // 0" shoulder design ease
        const chEval = getFitScore(diffChest, 4.0);      // 4" chest wearing + design ease
        const waEval = getFitScore(diffWaist, 3.0);      // 3" waist ease

        sizeData[sz].measurements = [
          { label: 'Shoulders', ease: `${diffShoulders >= 0 ? '+' : ''}${diffShoulders.toFixed(1)}" ease`, badge: shEval.badge, status: shEval.status },
          { label: 'Chest', ease: `${diffChest >= 0 ? '+' : ''}${diffChest.toFixed(1)}" ease`, badge: chEval.badge, status: chEval.status },
          { label: 'Waist', ease: `${diffWaist >= 0 ? '+' : ''}${diffWaist.toFixed(1)}" ease`, badge: waEval.badge, status: waEval.status }
        ];

        // Custom designer intent card text
        if (diffChest < -1.0) {
          sizeData[sz].intent = `Size ${sz} is rejected. It will restrict movements and chest breathing (${diffChest.toFixed(1)}" ease).`;
        } else if (diffChest <= 0.5) {
          sizeData[sz].intent = `Size ${sz} is a snug, tailored fit. Ideal if you prefer a close body fit with minimal drape.`;
        } else if (diffChest <= 4.0) {
          sizeData[sz].intent = `Size ${sz} matches the designer's intent. Provides comfortable wearing ease without feeling loose.`;
        } else {
          sizeData[sz].intent = `Size ${sz} is a relaxed, oversized look on your body profile (+${diffChest.toFixed(1)}" ease).`;
        }
      });

      // Sizing logic recommendation: find smallest size that comfortably fits chest and shoulders (Category A constraints)
      let recommended = 'L'; // Fallback
      if (sizeChart['S'].shoulders - sBody >= -1.0 && sizeChart['S'].chest - cBody >= -1.0) {
        recommended = 'S';
      } else if (sizeChart['M'].shoulders - sBody >= -1.0 && sizeChart['M'].chest - cBody >= -1.0) {
        recommended = 'M';
      }

      userRecommendedSize = recommended;
      activeSizeIndex = sizesArray.indexOf(userRecommendedSize);

      hideEditForm();
      updateSizeDetails(userRecommendedSize);
    });

    // Helper to evaluate Fit Score according to rulebook thresholds
    function getFitScore(diff, reqEase) {
      const actualEase = diff;
      const deviation = actualEase - reqEase;

      if (actualEase < -1.0) {
        return { badge: 'Tight', status: 'err' };
      } else if (actualEase < -0.25) {
        return { badge: 'Snug', status: 'warn' };
      } else if (Math.abs(deviation) <= 0.5) {
        return { badge: 'Ideal', status: 'ok' };
      } else if (deviation > 0.5 && deviation <= 2.5) {
        return { badge: 'Slightly loose', status: 'ok' };
      } else {
        return { badge: 'Loose', status: 'warn' };
      }
    }

    // Handle Size Option Button Clicks
    sizeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const sizeSelected = btn.getAttribute('data-size');
        activeSizeIndex = sizesArray.indexOf(sizeSelected);
        updateSizeDetails(sizeSelected);
      });
    });

    // Next/Prev Buttons
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (activeSizeIndex > 0) {
          activeSizeIndex--;
          updateSizeDetails(sizesArray[activeSizeIndex]);
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (activeSizeIndex < sizesArray.length - 1) {
          activeSizeIndex++;
          updateSizeDetails(sizesArray[activeSizeIndex]);
        }
      });
    }

    function updateSizeDetails(size) {
      // 1. Update active button class
      sizeBtns.forEach(btn => {
        if (btn.getAttribute('data-size') === size) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      const data = sizeData[size];
      if (!data) return;

      // 2. Update Best Option Value text
      if (bestSizeValEl) {
        bestSizeValEl.textContent = data.size;
      }

      // 3. Update Description Card
      if (intentTextEl) {
        intentTextEl.textContent = data.intent;
      }

      // 4. Update Text Sizing List
      const listEl = document.getElementById(`styla-text-list-${blockId}`);
      if (listEl) {
        listEl.innerHTML = data.measurements.map(m => `
          <li class="styla-text-fit-item">
            <span class="styla-item-label">${m.label}</span>
            <span class="styla-item-badge ${m.status}">${m.badge}</span>
            <span class="styla-item-ease">${m.ease}</span>
          </li>
        `).join('');
      }
    }

    // AI Tailor Chat Interaction
    chatSend.addEventListener('click', handleChatSubmit);
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleChatSubmit();
    });

    function appendMessage(text, type) {
      const bubble = document.createElement('div');
      bubble.className = `chat-msg ${type}`;
      bubble.innerHTML = `<p>${text}</p>`;
      chatHistory.appendChild(bubble);
      chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    function handleChatSubmit() {
      const query = chatInput.value.trim();
      if (!query) return;
      
      appendMessage(query, 'user');
      chatInput.value = '';
      
      setTimeout(() => {
        const response = generateAIResponse(query);
        appendMessage(response, 'system');
      }, 700);
    }

    function generateAIResponse(msg) {
      const text = msg.toLowerCase();
      
      if (text.includes('waist') || text.includes('gap')) {
        return `Based on your digital twin, Size M is correct because of your chest size. However, you will have about **+2.8" ease** at the waist. If you normally get a waist gap in trousers/tops, it will sit loosely here. This is a design feature for a relaxed silhouette.`;
      }
      if (text.includes('stretch') || text.includes('elastic') || text.includes('fabric')) {
        return `This garment is made of 100% rigid organic cotton with **0% elastane stretch**. Because it is a rigid woven fabric, we have allowed for a generous **+3.5" chest ease** to guarantee comfortable movement and breathing.`;
      }
      if (text.includes('shrink') || text.includes('wash')) {
        return `This fabric is pre-shrunk, but raw cotton can still shrink about 1-2% if washed in warm water. We recommend cold wash and air drying. Our sizing recommendation takes this slight shrinkage tolerance into account!`;
      }
      
      return `As your STYLA AI Tailor, I recommend sticking to the calculated size. It balances your shoulders and chest requirements. Let me know if you want to compare it with any specific sizing constraints!`;
    }
  });
});
