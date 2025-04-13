// Globale variabelen
let washers = [];
let notificationPermission = false;

// DOM elementen
const washersList = document.getElementById('washers-list');
const addWasherForm = document.getElementById('add-washer-form');
const notificationBanner = document.getElementById('notification-permission');
const enableNotificationsBtn = document.getElementById('enable-notifications');

// Controleer of de browser notificaties ondersteunt
const notificationsSupported = 'Notification' in window;

// Initialisatie
document.addEventListener('DOMContentLoaded', () => {
    // Laad opgeslagen wasmachines uit localStorage
    loadWashers();
    
    // Controleer notificatie permissies
    checkNotificationPermission();
    
    // Event listeners
    addWasherForm.addEventListener('submit', handleAddWasher);
    enableNotificationsBtn.addEventListener('click', requestNotificationPermission);
    
    // Start de timer die elke seconde de wasmachines bijwerkt
    setInterval(updateWashers, 1000);
});

// Controleer notificatie permissies
function checkNotificationPermission() {
    if (!notificationsSupported) {
        console.log('Deze browser ondersteunt geen notificaties');
        return;
    }
    
    if (Notification.permission === 'granted') {
        notificationPermission = true;
        notificationBanner.classList.add('hidden');
    } else if (Notification.permission !== 'denied') {
        notificationBanner.classList.remove('hidden');
    }
}

// Vraag toestemming voor notificaties
async function requestNotificationPermission() {
    if (!notificationsSupported) return;
    
    try {
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            notificationPermission = true;
            notificationBanner.classList.add('hidden');
            showNotification('WasChecker', 'Notificaties zijn nu ingeschakeld!');
        }
    } catch (error) {
        console.error('Fout bij het aanvragen van notificatie toestemming:', error);
    }
}

// Toon een notificatie
function showNotification(title, body) {
    if (!notificationPermission) return;
    
    try {
        const notification = new Notification(title, {
            body: body,
            icon: 'favicon.svg'
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    } catch (error) {
        console.error('Fout bij het tonen van notificatie:', error);
    }
}

// Voeg een nieuwe wasmachine toe
function handleAddWasher(event) {
    event.preventDefault();
    
    const nameInput = document.getElementById('washer-name');
    const timeInput = document.getElementById('washer-time');
    
    const name = nameInput.value.trim();
    const totalMinutes = parseInt(timeInput.value, 10);
    
    if (!name || isNaN(totalMinutes) || totalMinutes <= 0) {
        alert('Vul een geldige naam en tijd in.');
        return;
    }
    
    // Bereken eindtijd
    const endTime = new Date();
    endTime.setMinutes(endTime.getMinutes() + totalMinutes);
    
    // Maak nieuw washer object
    const washer = {
        id: Date.now().toString(),
        name: name,
        endTime: endTime.getTime(),
        totalSeconds: totalMinutes * 60,
        remainingSeconds: totalMinutes * 60,
        completed: false,
        notified: false,
        halfwayNotified: false,
        tenMinutesNotified: false
    };
    
    // Voeg toe aan array en update UI
    washers.push(washer);
    saveWashers();
    renderWashers();
    
    // Reset formulier
    nameInput.value = '';
    timeInput.value = '60';
    nameInput.focus();
}

// Update alle wasmachines
function updateWashers() {
    const now = new Date().getTime();
    let updated = false;
    
    washers.forEach(washer => {
        if (washer.completed) return;
        
        // Bereken resterende tijd
        const timeLeft = washer.endTime - now;
        
        if (timeLeft <= 0) {
            // Wasmachine is klaar
            washer.remainingSeconds = 0;
            washer.completed = true;
            updated = true;
            
            // Stuur notificatie als dat nog niet is gebeurd
            if (!washer.notified) {
                showNotification(
                    'Wasmachine klaar!', 
                    `${washer.name} is klaar met wassen.`
                );
                washer.notified = true;
            }
        } else {
            // Update resterende tijd
            washer.remainingSeconds = Math.ceil(timeLeft / 1000);
            updated = true;
            
            // Controleer of de wasmachine halverwege is
            const halfwayPoint = washer.totalSeconds / 2;
            const elapsedSeconds = washer.totalSeconds - washer.remainingSeconds;
            
            if (elapsedSeconds >= halfwayPoint && !washer.halfwayNotified) {
                showNotification(
                    'Wasmachine halverwege!',
                    `${washer.name} is halverwege het wasprogramma.`
                );
                washer.halfwayNotified = true;
            }
            
            // Controleer of er nog 10 minuten resteren
            const tenMinutesInSeconds = 10 * 60;
            if (washer.remainingSeconds <= tenMinutesInSeconds && !washer.tenMinutesNotified) {
                showNotification(
                    'Nog 10 minuten te gaan!',
                    `${washer.name} is over 10 minuten klaar.`
                );
                washer.tenMinutesNotified = true;
            }
        }
    });
    
    // Update UI alleen als er iets is veranderd
    if (updated) {
        renderWashers();
        saveWashers();
    }
}

// Render alle wasmachines in de UI
function renderWashers() {
    // Verwijder bestaande inhoud
    washersList.innerHTML = '';
    
    if (washers.length === 0) {
        // Toon lege staat als er geen wasmachines zijn
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = '<p>Geen actieve wasmachines. Voeg een nieuwe wasmachine toe om te beginnen.</p>';
        washersList.appendChild(emptyState);
        return;
    }
    
    // Sorteer wasmachines: eerst actieve (op resterende tijd), dan voltooide
    const sortedWashers = [...washers].sort((a, b) => {
        if (a.completed && !b.completed) return 1;
        if (!a.completed && b.completed) return -1;
        return a.remainingSeconds - b.remainingSeconds;
    });
    
    // Maak een kaart voor elke wasmachine
    sortedWashers.forEach(washer => {
        const washerCard = document.createElement('div');
        washerCard.className = `washer-card ${washer.completed ? 'washer-completed' : ''}`;
        washerCard.id = `washer-${washer.id}`;
        
        // Bereken voortgang als percentage
        const progressPercent = Math.max(
            0, 
            Math.min(
                100, 
                ((washer.totalSeconds - washer.remainingSeconds) / washer.totalSeconds) * 100
            )
        );
        
        // Formatteer resterende tijd
        const timeDisplay = formatTime(washer.remainingSeconds);
        
        // Bouw HTML voor de kaart
        washerCard.innerHTML = `
            <h3>${washer.name}</h3>
            <div class="time-remaining">${washer.completed ? 'Klaar!' : timeDisplay}</div>
            <div class="progress-container">
                <div class="progress-bar" style="width: ${progressPercent}%"></div>
            </div>
            <div class="washer-actions">
                <button class="btn btn-danger delete-washer" data-id="${washer.id}">Verwijderen</button>
                ${!washer.completed ? `<button class="btn btn-primary reset-washer" data-id="${washer.id}">Resetten</button>` : ''}
            </div>
        `;
        
        washersList.appendChild(washerCard);
    });
    
    // Voeg event listeners toe aan de knoppen
    document.querySelectorAll('.delete-washer').forEach(button => {
        button.addEventListener('click', handleDeleteWasher);
    });
    
    document.querySelectorAll('.reset-washer').forEach(button => {
        button.addEventListener('click', handleResetWasher);
    });
}

// Formatteer seconden naar mm:ss formaat
function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Verwijder een wasmachine
function handleDeleteWasher(event) {
    const washerId = event.target.dataset.id;
    washers = washers.filter(washer => washer.id !== washerId);
    saveWashers();
    renderWashers();
}

// Reset een wasmachine timer
function handleResetWasher(event) {
    const washerId = event.target.dataset.id;
    const washer = washers.find(w => w.id === washerId);
    
    if (washer) {
        // Reset naar originele tijd
        const endTime = new Date();
        endTime.setSeconds(endTime.getSeconds() + washer.totalSeconds);
        
        washer.endTime = endTime.getTime();
        washer.remainingSeconds = washer.totalSeconds;
        washer.completed = false;
        washer.notified = false;
        washer.halfwayNotified = false;
        washer.tenMinutesNotified = false;
        
        saveWashers();
        renderWashers();
    }
}

// Sla wasmachines op in localStorage
function saveWashers() {
    try {
        localStorage.setItem('washers', JSON.stringify(washers));
    } catch (error) {
        console.error('Fout bij het opslaan van wasmachines:', error);
    }
}

// Laad wasmachines uit localStorage
function loadWashers() {
    try {
        const savedWashers = localStorage.getItem('washers');
        if (savedWashers) {
            washers = JSON.parse(savedWashers);
        }
    } catch (error) {
        console.error('Fout bij het laden van wasmachines:', error);
        washers = [];
    }
}