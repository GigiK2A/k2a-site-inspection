document.addEventListener('DOMContentLoaded', function() {
  // Global state
  let currentSiteType = null; // 'rawland' or 'rooftop'
  let checklistData = null;
  let currentStepIndex = 0;
  
  // Oggetto globale per memorizzare tutti i dati del form
  let formData = {
    siteType: null,
    siteName: "",
    inspectionDate: "",
    technicianName: "",
    checklistItems: {},  // { itemId: value }
    notes: {},           // { itemId: noteText }
    photos: {}           // { itemId: [photoPath1, photoPath2, ...] }
  };
  
  // DOM Elements
  const newReportBtn = document.getElementById('newReportBtn');
  const savedReportsBtn = document.getElementById('savedReportsBtn');
  const rawlandBtn = document.getElementById('rawlandBtn');
  const rooftopBtn = document.getElementById('rooftopBtn');
  const siteTypeSelection = document.getElementById('siteTypeSelection');
  const reportForm = document.getElementById('reportForm');
  const siteTypeLabel = document.getElementById('siteTypeLabel');
  const checklistStepContainer = document.getElementById('checklistStepContainer');
  const inspectionForm = document.getElementById('inspectionForm');
  const nextStepBtn = document.getElementById('nextStepBtn');
  const prevStepBtn = document.getElementById('prevStepBtn');
  const generatePdfBtn = document.getElementById('generatePdfBtn');
  
  // Event Listeners
  newReportBtn.addEventListener('click', showSiteTypeSelection);
  rawlandBtn.addEventListener('click', () => selectSiteType('rawland'));
  rooftopBtn.addEventListener('click', () => selectSiteType('rooftop'));
  nextStepBtn.addEventListener('click', goToNextStep);
  prevStepBtn.addEventListener('click', goToPrevStep);
  
  // Functions to handle site type selection
  function showSiteTypeSelection() {
    // Hide initial cards
    document.querySelectorAll('.card').forEach(card => {
      if (card.id !== 'siteTypeSelection') {
        card.style.display = 'none';
      }
    });
    
    // Show site type selection
    siteTypeSelection.style.display = 'block';
  }
  
  function selectSiteType(type) {
    currentSiteType = type;
    
    // Update UI
    siteTypeLabel.textContent = type === 'rawland' ? '(Rawland)' : '(Rooftop)';
    
    // Hide site type selection, show report form
    siteTypeSelection.style.display = 'none';
    reportForm.classList.remove('hidden');
    
    // Fetch checklist data
    fetchChecklist();
  }
  
  // Fetch checklist items from the server
  async function fetchChecklist() {
    try {
      console.log('Fetching checklist data...');
      const response = await fetch('/api/checklist');
      
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Received checklist data:', data);
      
      // Create steps for our items if needed (backward compatibility)
      if (data && data.items && Array.isArray(data.items) && !data.steps) {
        console.log('Converting items format to steps format');
        // We're receiving the old format with items, let's convert it to an array of steps
        checklistData = [
          {
            id: 1,
            title: "Lista di Controllo",
            description: "Elementi da verificare durante il sopralluogo",
            items: data.items.map(item => {
              // Add forSiteTypes to each item if it doesn't have one
              if (!item.forSiteTypes) {
                item.forSiteTypes = ["all"];
              }
              // Add ability to add notes and photos
              if (item.allowNotes === undefined) {
                item.allowNotes = true;
              }
              if (item.allowPhotos === undefined) {
                item.allowPhotos = true;
              }
              return item;
            })
          }
        ];
      } else if (data && data.steps && Array.isArray(data.steps)) {
        // We're receiving the new format with steps
        checklistData = data.steps;
      } else {
        throw new Error('Invalid data structure received from server');
      }
      
      if (!checklistData || !Array.isArray(checklistData) || checklistData.length === 0) {
        throw new Error('No data found in the server response');
      }
      
      // Display the first step
      displayStep(0);
    } catch (error) {
      console.error('Error fetching checklist:', error);
      checklistStepContainer.innerHTML = `
        <p class="error">Errore nel caricamento della lista di controllo: ${error.message}</p>
        <button type="button" id="retryFetchBtn" class="btn primary">Riprova</button>
      `;
      
      document.getElementById('retryFetchBtn').addEventListener('click', function() {
        fetchChecklist();
      });
    }
  }
  
  // Display a specific step of the checklist
  function displayStep(stepIndex) {
    console.log('Displaying step:', stepIndex);
    console.log('Checklist data:', checklistData);
    
    if (!checklistData || !Array.isArray(checklistData)) {
      console.error('Checklist data is not available or not an array');
      checklistStepContainer.innerHTML = '<p class="error">Errore nel caricamento della lista di controllo. Riprova più tardi.</p>';
      return;
    }
    
    if (stepIndex < 0 || stepIndex >= checklistData.length) {
      console.error('Step index out of bounds:', stepIndex);
      return;
    }
    
    currentStepIndex = stepIndex;
    const step = checklistData[stepIndex];
    
    if (!step || !step.items || !Array.isArray(step.items)) {
      console.error('Invalid step data at index', stepIndex);
      checklistStepContainer.innerHTML = '<p class="error">Errore nei dati del passo corrente. Riprova più tardi.</p>';
      return;
    }
    
    // Clear container
    checklistStepContainer.innerHTML = '';
    
    // Create step header
    const stepHeader = document.createElement('div');
    stepHeader.className = 'step-header';
    stepHeader.innerHTML = `
      <h3 class="step-title">${step.title}</h3>
      <span>${stepIndex + 1}/${checklistData.length}</span>
    `;
    checklistStepContainer.appendChild(stepHeader);
    
    // Add step description if available
    if (step.description) {
      const stepDesc = document.createElement('p');
      stepDesc.className = 'step-description';
      stepDesc.textContent = step.description;
      checklistStepContainer.appendChild(stepDesc);
    }
    
    // Filter items based on site type
    const relevantItems = step.items.filter(item => {
      return item.forSiteTypes && (item.forSiteTypes.includes('all') || item.forSiteTypes.includes(currentSiteType));
    });
    
    // No items for this site type in this step
    if (relevantItems.length === 0) {
      const noItems = document.createElement('p');
      noItems.className = 'no-items-message';
      noItems.textContent = 'Nessun elemento da compilare in questo passo per la tipologia di sito selezionata.';
      checklistStepContainer.appendChild(noItems);
    } else {
      // Add items
      relevantItems.forEach(item => {
        const itemDiv = createChecklistItemElement(item);
        checklistStepContainer.appendChild(itemDiv);
      });
    }
    
    // Update buttons
    updateNavigationButtons();
  }
  
  // Create a checklist item element
  // Funzioni per aggiornare lo stato globale
  function updateFormItemValue(itemId, value) {
    formData.checklistItems[itemId] = value;
    console.log(`Item ${itemId} aggiornato:`, value);
  }
  
  function updateFormNoteValue(itemId, noteText) {
    formData.notes[itemId] = noteText;
    console.log(`Nota per item ${itemId} aggiornata:`, noteText);
  }
  
  function addPhotoToFormData(itemId, photoPath) {
    if (!formData.photos[itemId]) {
      formData.photos[itemId] = [];
    }
    formData.photos[itemId].push(photoPath);
    console.log(`Foto aggiunta per item ${itemId}:`, photoPath);
  }
  
  function removePhotoFromFormData(itemId, photoPath) {
    if (formData.photos[itemId] && Array.isArray(formData.photos[itemId])) {
      const index = formData.photos[itemId].indexOf(photoPath);
      if (index !== -1) {
        formData.photos[itemId].splice(index, 1);
        console.log(`Foto rimossa per item ${itemId}:`, photoPath);
      }
    }
  }
  
  function createChecklistItemElement(item) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'checklist-item';
    itemDiv.id = `item-${item.id}`;
    
    // Item header with category label
    const header = document.createElement('div');
    header.className = 'checklist-item-header';
    
    const categorySpan = document.createElement('span');
    categorySpan.className = `checklist-item-category ${item.category}`;
    categorySpan.textContent = item.category;
    header.appendChild(categorySpan);
    
    itemDiv.appendChild(header);
    
    // Item content (input controls)
    const content = document.createElement('div');
    content.className = 'checklist-item-content';
    
    // Create input element based on item type
    switch (item.type) {
      case 'checkbox':
        content.innerHTML = `
          <label>
            <input type="checkbox" name="item_${item.id}" id="input_${item.id}">
            ${item.label}
          </label>
        `;
        break;
        
      case 'text':
        content.innerHTML = `
          <label for="input_${item.id}">${item.label}</label>
          <input type="text" name="item_${item.id}" id="input_${item.id}">
        `;
        break;
        
      case 'textarea':
        content.innerHTML = `
          <label for="input_${item.id}">${item.label}</label>
          <textarea name="item_${item.id}" id="input_${item.id}" rows="3"></textarea>
        `;
        break;
        
      case 'date':
        content.innerHTML = `
          <label for="input_${item.id}">${item.label}</label>
          <input type="date" name="item_${item.id}" id="input_${item.id}">
        `;
        break;
        
      case 'number':
        content.innerHTML = `
          <label for="input_${item.id}">${item.label}</label>
          <input type="number" name="item_${item.id}" id="input_${item.id}">
        `;
        break;
        
      case 'select':
        let options = '';
        if (item.options) {
          options = item.options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
        }
        content.innerHTML = `
          <label for="input_${item.id}">${item.label}</label>
          <select name="item_${item.id}" id="input_${item.id}">
            <option value="">Seleziona un'opzione</option>
            ${options}
          </select>
        `;
        break;
        
      case 'multiselect':
        let checkboxes = '';
        if (item.options) {
          checkboxes = item.options.map((opt, idx) => `
            <div class="checkbox-option">
              <input type="checkbox" id="input_${item.id}_${idx}" name="item_${item.id}" value="${opt}">
              <label for="input_${item.id}_${idx}">${opt}</label>
            </div>
          `).join('');
        }
        content.innerHTML = `
          <label>${item.label}</label>
          <div class="multiselect-options">
            ${checkboxes}
          </div>
        `;
        break;
        
      case 'photo':
        content.innerHTML = `
          <label>${item.label}</label>
          <div class="photo-container" id="photos_${item.id}"></div>
          <button type="button" class="add-photo-btn action-btn" data-item-id="${item.id}">
            <span>📷</span> Aggiungi foto
          </button>
        `;
        break;
        
      case 'signature':
        content.innerHTML = `
          <label>${item.label}</label>
          <div class="signature-pad-container">
            <div class="signature-pad" id="signature_${item.id}"></div>
            <div class="signature-actions">
              <button type="button" class="clear-signature-btn action-btn" data-item-id="${item.id}">Cancella</button>
              <button type="button" class="save-signature-btn action-btn" data-item-id="${item.id}">Salva Firma</button>
            </div>
          </div>
        `;
        break;
        
      default:
        content.innerHTML = `<p>Tipo di campo non supportato: ${item.type}</p>`;
    }
    
    itemDiv.appendChild(content);
    
    // Add actions for notes and photos if allowed
    if (item.allowNotes || item.allowPhotos) {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'checklist-item-actions';
      
      if (item.allowNotes && item.type !== 'textarea') {
        actionsDiv.innerHTML += `
          <button type="button" class="action-btn add-note-btn" data-item-id="${item.id}">
            <span>📝</span> Aggiungi Note
          </button>
          <div class="note-container" id="note_container_${item.id}">
            <textarea id="note_${item.id}" name="note_${item.id}" placeholder="Inserisci note aggiuntive qui..." rows="3"></textarea>
          </div>
        `;
      }
      
      if (item.allowPhotos && item.type !== 'photo') {
        actionsDiv.innerHTML += `
          <button type="button" class="action-btn add-photo-btn" data-item-id="${item.id}">
            <span>📷</span> Aggiungi Foto
          </button>
          <div class="photo-container" id="photos_${item.id}"></div>
        `;
      }
      
      itemDiv.appendChild(actionsDiv);
    }
    
    return itemDiv;
  }
  
  // Funzione per salvare i dati nello stato globale prima di cambiare step
  function saveCurrentStepData() {
    // Aggiorna i dati del form principale
    formData.siteType = currentSiteType;
    const siteNameInput = document.getElementById('siteName');
    const inspectionDateInput = document.getElementById('inspectionDate');
    const technicianNameInput = document.getElementById('technicianName');
    
    if (siteNameInput) formData.siteName = siteNameInput.value;
    if (inspectionDateInput) formData.inspectionDate = inspectionDateInput.value;
    if (technicianNameInput) formData.technicianName = technicianNameInput.value;
    
    // Salva i dati degli elementi della checklist
    if (checklistData && Array.isArray(checklistData) && currentStepIndex >= 0 && currentStepIndex < checklistData.length) {
      const currentStep = checklistData[currentStepIndex];
      if (currentStep && currentStep.items && Array.isArray(currentStep.items)) {
        // Filtra per gli elementi rilevanti per il tipo di sito
        const relevantItems = currentStep.items.filter(item => 
          item.forSiteTypes && (item.forSiteTypes.includes('all') || item.forSiteTypes.includes(currentSiteType))
        );
        
        // Per ogni elemento, salva valore, note e foto
        relevantItems.forEach(item => {
          // Input value
          const inputElement = document.getElementById(`input_${item.id}`);
          if (inputElement) {
            if (item.type === 'checkbox') {
              formData.checklistItems[item.id] = inputElement.checked;
            } else {
              formData.checklistItems[item.id] = inputElement.value;
            }
          }
          
          // Note
          const noteElement = document.getElementById(`note_${item.id}`);
          if (noteElement) {
            formData.notes[item.id] = noteElement.value || '';
          }
          
          // Photos - questi sono già salvati quando vengono caricati o rimossi
          // tramite eventi, quindi non c'è bisogno di fare altro qui
        });
      }
    }
    
    console.log("Stato form aggiornato:", formData);
  }
  
  // Funzione per ripopolare gli elementi del form dai dati in memoria
  function populateStepWithSavedData() {
    // Ripopola gli input principali del form
    const siteNameInput = document.getElementById('siteName');
    const inspectionDateInput = document.getElementById('inspectionDate');
    const technicianNameInput = document.getElementById('technicianName');
    
    if (siteNameInput && formData.siteName) siteNameInput.value = formData.siteName;
    if (inspectionDateInput && formData.inspectionDate) inspectionDateInput.value = formData.inspectionDate;
    if (technicianNameInput && formData.technicianName) technicianNameInput.value = formData.technicianName;
    
    // Ripopola gli elementi della checklist per lo step corrente
    if (checklistData && Array.isArray(checklistData) && currentStepIndex >= 0 && currentStepIndex < checklistData.length) {
      const currentStep = checklistData[currentStepIndex];
      if (currentStep && currentStep.items && Array.isArray(currentStep.items)) {
        // Filtra per gli elementi rilevanti per il tipo di sito
        const relevantItems = currentStep.items.filter(item => 
          item.forSiteTypes && (item.forSiteTypes.includes('all') || item.forSiteTypes.includes(currentSiteType))
        );
        
        // Per ogni elemento, ripopola valore, note e foto
        relevantItems.forEach(item => {
          // Input value
          const inputElement = document.getElementById(`input_${item.id}`);
          if (inputElement && item.id in formData.checklistItems) {
            if (item.type === 'checkbox') {
              inputElement.checked = !!formData.checklistItems[item.id];
            } else {
              inputElement.value = formData.checklistItems[item.id] || '';
            }
          }
          
          // Note
          const noteElement = document.getElementById(`note_${item.id}`);
          if (noteElement && item.id in formData.notes) {
            noteElement.value = formData.notes[item.id] || '';
          }
          
          // Photos - ricrea gli elementi delle foto dai dati salvati
          const photoContainer = document.getElementById(`photos_${item.id}`);
          if (photoContainer && formData.photos[item.id] && Array.isArray(formData.photos[item.id]) && formData.photos[item.id].length > 0) {
            // Svuota il container
            photoContainer.innerHTML = '';
            
            // Ricrea ogni elemento foto
            formData.photos[item.id].forEach(photoPath => {
              const photoItem = document.createElement('div');
              photoItem.className = 'photo-item';
              photoItem.dataset.path = photoPath;
              photoItem.innerHTML = `
                <img src="${photoPath}" alt="Immagine caricata">
                <button class="remove-photo" data-item-id="${item.id}">&times;</button>
              `;
              photoContainer.appendChild(photoItem);
            });
          }
        });
      }
    }
  }
  
  // Navigation functions
  function goToNextStep() {
    // Safety check for checklistData
    if (!checklistData || !Array.isArray(checklistData)) {
      console.error('Checklist data is not available or not an array');
      return;
    }
    
    // Salva i dati dello step corrente
    saveCurrentStepData();
    
    // If last step, show generate PDF button
    if (currentStepIndex === checklistData.length - 1) {
      nextStepBtn.classList.add('hidden');
      generatePdfBtn.classList.remove('hidden');
      return;
    }
    
    // Otherwise go to next step
    displayStep(currentStepIndex + 1);
    
    // Popola il nuovo step con i dati salvati
    populateStepWithSavedData();
  }
  
  function goToPrevStep() {
    // Safety check for checklistData
    if (!checklistData || !Array.isArray(checklistData)) {
      console.error('Checklist data is not available or not an array');
      return;
    }
    
    // Salva i dati dello step corrente
    saveCurrentStepData();
    
    // If we're on first step, return to site type selection
    if (currentStepIndex === 0) {
      reportForm.classList.add('hidden');
      siteTypeSelection.style.display = 'block';
      return;
    }
    
    // Otherwise go to previous step
    displayStep(currentStepIndex - 1);
    
    // Popola il nuovo step con i dati salvati
    populateStepWithSavedData();
  }
  
  function updateNavigationButtons() {
    // Safety check for checklistData
    if (!checklistData || !Array.isArray(checklistData)) {
      console.error('Checklist data is not available or not an array');
      prevStepBtn.textContent = 'Torna Indietro';
      nextStepBtn.textContent = 'Successivo';
      return;
    }
    
    // Update prev button
    prevStepBtn.textContent = currentStepIndex === 0 ? 'Torna Indietro' : 'Precedente';
    
    // Update next button
    if (currentStepIndex === checklistData.length - 1) {
      nextStepBtn.textContent = 'Riepilogo';
    } else {
      nextStepBtn.textContent = 'Successivo';
      nextStepBtn.classList.remove('hidden');
      generatePdfBtn.classList.add('hidden');
    }
  }
  
  // Form submission
  inspectionForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Safety check for form and data
    if (!inspectionForm || !checklistData || !Array.isArray(checklistData)) {
      console.error('Form data or checklist data is not available');
      alert('Si è verificato un errore nel processare il verbale. Riprova più tardi.');
      return;
    }
    
    // Salva i dati dello step corrente prima di procedere
    saveCurrentStepData();
    
    // Crea l'oggetto reportData usando i dati memorizzati nello stato globale
    const reportData = {
      siteType: formData.siteType,
      siteName: formData.siteName,
      inspectionDate: formData.inspectionDate,
      technicianName: formData.technicianName,
      checklistItems: formData.checklistItems,
      notes: formData.notes,
      photos: formData.photos
    };
    
    try {
      // Log dei dati completi prima dell'invio
      console.log('Invio report con dati completi:', reportData);
      
      // Log dei dati
      console.log('Report Data:', reportData);
      
      try {
        // Invia i dati al server per generare il PDF
        const generateResponse = await fetch('/api/generate-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(reportData)
        });
        
        if (!generateResponse.ok) {
          throw new Error(`Errore nella generazione del PDF: ${generateResponse.status}`);
        }
        
        const pdfData = await generateResponse.json();
        
        if (pdfData.success) {
          // Mostra il modale con il link al PDF
          const modal = document.createElement('div');
          modal.className = 'modal show';
          modal.innerHTML = `
            <div class="modal-content">
              <div class="modal-header">
                <h3>Verbale Generato</h3>
                <button type="button" class="close-modal">&times;</button>
              </div>
              <div class="modal-body">
                <p>Il verbale è stato generato con successo!</p>
                <p>Puoi <a href="${pdfData.filePath}" target="_blank">visualizzare il PDF</a> o tornare alla home page.</p>
                <div class="modal-actions">
                  <button type="button" class="btn primary view-pdf-btn">Visualizza PDF</button>
                  <button type="button" class="btn secondary close-modal-btn">Chiudi</button>
                </div>
              </div>
            </div>
          `;
          
          document.body.appendChild(modal);
          
          // Aggiungi handler per chiudere il modale
          const closeButtons = modal.querySelectorAll('.close-modal, .close-modal-btn');
          closeButtons.forEach(btn => {
            btn.addEventListener('click', function() {
              document.body.removeChild(modal);
            });
          });
          
          // Aggiungi handler per aprire il PDF
          const viewPdfBtn = modal.querySelector('.view-pdf-btn');
          viewPdfBtn.addEventListener('click', function() {
            window.open(pdfData.filePath, '_blank');
          });
        } else {
          throw new Error('Errore nella generazione del PDF');
        }
      } catch (pdfError) {
        console.error('Errore nella generazione del PDF:', pdfError);
        alert('Si è verificato un errore nella generazione del PDF: ' + pdfError.message);
      }
    } catch (error) {
      console.error('Error processing form data:', error);
      alert('Si è verificato un errore nel processare il verbale. Riprova più tardi.');
    } finally {
      // Reset the form and go back to home
      resetForm();
    }
  });
  
  function resetForm() {
    if (inspectionForm) {
      inspectionForm.reset();
    }
    
    if (reportForm) {
      reportForm.classList.add('hidden');
    }
    
    currentStepIndex = 0;
    currentSiteType = null;
    
    // Reset formData globale
    formData = {
      siteType: null,
      siteName: "",
      inspectionDate: "",
      technicianName: "",
      checklistItems: {},
      notes: {},
      photos: {}
    };
    
    // Make all cards visible again
    document.querySelectorAll('.card').forEach(card => {
      card.style.display = 'block';
    });
    
    // Clear any form data
    if (checklistStepContainer) {
      checklistStepContainer.innerHTML = '';
    }
  }
  
  // Add event listeners for dynamic elements
  document.body.addEventListener('click', function(e) {
    // Add note button
    if (e.target.classList.contains('add-note-btn') || e.target.parentElement.classList.contains('add-note-btn')) {
      const button = e.target.classList.contains('add-note-btn') ? e.target : e.target.parentElement;
      const itemId = button.dataset.itemId;
      const noteContainer = document.getElementById(`note_container_${itemId}`);
      
      if (noteContainer) {
        noteContainer.classList.toggle('show');
        button.textContent = noteContainer.classList.contains('show') ? 'Nascondi Note' : 'Aggiungi Note';
        
        // Aggiunge l'event listener per salvare la nota mentre l'utente digita
        const noteTextarea = noteContainer.querySelector('textarea');
        if (noteTextarea) {
          // Rimuove eventuali listener precedenti per evitare duplicati
          noteTextarea.removeEventListener('input', noteTextarea._saveNote);
          
          // Assegna una funzione che salva la nota nello stato globale
          noteTextarea._saveNote = function() {
            updateFormNoteValue(itemId, this.value);
          };
          
          // Aggiungi l'event listener e salva la nota iniziale se presente
          noteTextarea.addEventListener('input', noteTextarea._saveNote);
          
          // Salva la nota esistente, se presente
          if (noteTextarea.value) {
            updateFormNoteValue(itemId, noteTextarea.value);
          }
        }
      }
    }
    
    // Add photo button
    if (e.target.classList.contains('add-photo-btn') || e.target.parentElement.classList.contains('add-photo-btn')) {
      const button = e.target.classList.contains('add-photo-btn') ? e.target : e.target.parentElement;
      const itemId = button.dataset.itemId;
      const photoContainer = document.getElementById(`photos_${itemId}`);
      
      if (photoContainer) {
        // Crea un input file nascosto e cliccaci sopra
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', async function(e) {
          if (this.files && this.files[0]) {
            const file = this.files[0];
            
            // Creare un oggetto FormData per inviare il file
            const formDataObj = new FormData();
            formDataObj.append('photo', file);
            
            try {
              // Mostra un indicatore di caricamento
              const loadingItem = document.createElement('div');
              loadingItem.className = 'photo-item loading';
              loadingItem.innerHTML = `<span>Caricamento in corso...</span>`;
              photoContainer.appendChild(loadingItem);
              
              // Carica la foto sul server
              const response = await fetch('/api/upload-photo', {
                method: 'POST',
                body: formDataObj
              });
              
              // Rimuovi l'indicatore di caricamento
              photoContainer.removeChild(loadingItem);
              
              if (!response.ok) {
                throw new Error(`Errore nel caricamento: ${response.status}`);
              }
              
              const data = await response.json();
              
              if (data.success) {
                // Creare l'elemento per la foto
                const photoItem = document.createElement('div');
                photoItem.className = 'photo-item';
                photoItem.dataset.path = data.filePath; // Salva il percorso del file
                photoItem.innerHTML = `
                  <img src="${data.filePath}" alt="Immagine caricata">
                  <button class="remove-photo" data-item-id="${itemId}">&times;</button>
                `;
                photoContainer.appendChild(photoItem);
                
                // Salva il percorso della foto nello stato globale
                addPhotoToFormData(itemId, data.filePath);
              } else {
                alert('Errore nel caricamento della foto');
              }
            } catch (error) {
              console.error('Errore nel caricamento della foto:', error);
              alert('Errore nel caricamento della foto: ' + error.message);
            }
          }
        });
        
        document.body.appendChild(fileInput);
        fileInput.click();
        
        // Rimuovi l'input dopo l'uso
        fileInput.addEventListener('change', function() {
          setTimeout(() => {
            document.body.removeChild(fileInput);
          }, 5000); // Rimuovi dopo 5 secondi per dare tempo al caricamento
        });
      }
    }
    
    // Remove photo button
    if (e.target.classList.contains('remove-photo')) {
      const photoItem = e.target.parentElement;
      const itemId = e.target.dataset.itemId;
      const photoPath = photoItem.dataset.path;
      
      if (photoPath) {
        // Rimuovi la foto dallo stato globale
        removePhotoFromFormData(itemId, photoPath);
      }
      
      // Rimuovi l'elemento foto dal DOM
      photoItem.remove();
    }
  });
  
  // Visualizzazione dei verbali salvati
  savedReportsBtn.addEventListener('click', async function() {
    try {
      // Ottieni la lista dei PDF dal server
      const response = await fetch('/api/pdf-list');
      
      if (!response.ok) {
        throw new Error(`Errore nel recupero dei file: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.files || data.files.length === 0) {
        alert('Nessun verbale salvato trovato');
        return;
      }
      
      // Crea un modale per mostrare i file
      const modal = document.createElement('div');
      modal.className = 'modal show';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>Verbali Salvati</h3>
            <button type="button" class="close-modal">&times;</button>
          </div>
          <div class="modal-body">
            <p>Seleziona un verbale per visualizzarlo o scaricarlo:</p>
            <ul class="pdf-list">
              ${data.files.map(file => `
                <li>
                  <a href="${file.path}" target="_blank" class="pdf-link">
                    <span class="pdf-name">${file.name}</span>
                    <span class="pdf-date">${new Date(file.createdAt).toLocaleString()}</span>
                  </a>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Aggiungi handler per chiudere il modale
      const closeBtn = modal.querySelector('.close-modal');
      closeBtn.addEventListener('click', function() {
        document.body.removeChild(modal);
      });
      
    } catch (error) {
      console.error('Errore nel recupero dei verbali:', error);
      alert('Errore nel recupero dei verbali: ' + error.message);
    }
  });
});