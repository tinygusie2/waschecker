// Globale variabelen
let washers = [];
let notificationPermission = false;
let swRegistration = null;
let db = null;

// DOM elementen
const washersList = document.getElementById('washers-list');
const addWasherForm = document.getElementById('add-washer-form');
const notificationBanner = document.getElementById('notification-permission');
const enableNotificationsBtn = document.getElementById('enable-notifications');
const installAppBanner = document.getElementById('install-app');
const installButton = document.getElementById('install-button');

// Controleer of de browser notificaties ondersteunt
const notificationsSupported = 'Notification' in window;
const serviceWorkerSupported = 'serviceWorker' in navigator;

// Variabele om de installatie prompt op te slaan
let deferredPrompt;

// Initialisatie
document.addEventListener('DOMContentLoaded', async () => {
    // Open de database
    await openDatabase();
    
    // Laad opgeslagen wasmachines uit IndexedDB
    await loadWashers();
    
    // Registreer service worker als deze wordt ondersteund
    if (serviceWorkerSupported) {
        await registerServiceWorker();
    }
    
    // Controleer notificatie permissies
    checkNotificationPermission();
    
    // Event listeners
    addWasherForm.addEventListener('submit', handleAddWasher);
    enableNotificationsBtn.addEventListener('click', requestNotificationPermission);
    installButton.addEventListener('click', installApp);
    
    // Start de timer die elke seconde de wasmachines bijwerkt
    setInterval(updateWashers, 1000);
    
    // Registreer voor periodieke synchronisatie als browser dit ondersteunt
    registerPeriodicSync();
    
    // Voeg event listener toe voor online/offline status
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);
    
    // Controleer huidige online status
    updateOnlineStatus();
});

// Luister naar beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
    // Voorkom dat Chrome de standaard installatie prompt toont
    e.preventDefault();
    // Sla het event op zodat het later kan worden getriggerd
    deferredPrompt = e;
    // Toon de installatie banner
    installAppBanner.classList.remove('hidden');
});

// Luister naar appinstalled event
window.addEventListener('appinstalled', (e) => {
    // Verberg de installatie banner
    installAppBanner.classList.add('hidden');
    // Log het installatie event
    console.log('App is geïnstalleerd', e);
    // Reset de deferredPrompt variabele
    deferredPrompt = null;
});

// Installeer de app
async function installApp() {
    if (!deferredPrompt) {
        console.log('Kan app niet installeren: geen installatie prompt beschikbaar');
        return;
    }
    
    // Toon de installatie prompt
    deferredPrompt.prompt();
    
    // Wacht tot de gebruiker heeft gereageerd op de prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`Gebruiker heeft gekozen: ${outcome}`);
    
    // Reset de deferredPrompt variabele
    deferredPrompt = null;
    
    // Verberg de installatie banner
    installAppBanner.classList.add('hidden');
}

// Registreer service worker
async function registerServiceWorker() {
    try {
        swRegistration = await navigator.serviceWorker.register('service-worker.js');
        console.log('Service Worker geregistreerd:', swRegistration);
        
        // Registreer voor background sync
        await registerBackgroundSync();
    } catch (error) {
        console.error('Service Worker registratie mislukt:', error);
    }
}

// Registreer voor background sync
async function registerBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
            // Wacht tot de service worker klaar is
            const registration = await navigator.serviceWorker.ready;
            // Registreer voor background sync
            await registration.sync.register('sync-washers');
            console.log('Background sync geregistreerd');
        } catch (error) {
            console.error('Background sync registratie mislukt:', error);
        }
    } else {
        console.log('Background sync wordt niet ondersteund door deze browser');
    }
}

// Registreer voor periodieke synchronisatie
async function registerPeriodicSync() {
    if ('serviceWorker' in navigator && 'periodicSync' in navigator.serviceWorker) {
        try {
            // Wacht tot de service worker klaar is
            const registration = await navigator.serviceWorker.ready;
            
            // Controleer of we toestemming hebben voor periodieke sync
            const status = await navigator.permissions.query({
                name: 'periodic-background-sync',
            });
            
            if (status.state === 'granted') {
                // Registreer voor periodieke sync elke 15 minuten
                await registration.periodicSync.register('periodic-sync-washers', {
                    minInterval: 15 * 60 * 1000, // 15 minuten in milliseconden
                });
                console.log('Periodieke sync geregistreerd');
            } else {
                console.log('Geen toestemming voor periodieke sync');
            }
        } catch (error) {
            console.error('Periodieke sync registratie mislukt:', error);
        }
    } else {
        console.log('Periodieke sync wordt niet ondersteund door deze browser');
    }
}

// Afhandelen van online status
function handleOnlineStatus() {
    console.log('App is online');
    updateOnlineStatus(true);
    // Synchroniseer data met server (in toekomstige implementatie)
    syncWithServer();
}

// Afhandelen van offline status
function handleOfflineStatus() {
    console.log('App is offline');
    updateOnlineStatus(false);
}

// Update online status in de UI
function updateOnlineStatus(isOnline = navigator.onLine) {
    document.body.classList.toggle('offline', !isOnline);
    if (!isOnline) {
        showNotification('WasChecker', 'Je bent offline. De app werkt nog steeds, maar wijzigingen worden lokaal opgeslagen.');
    }
}

// Synchroniseer data met server (placeholder voor toekomstige implementatie)
async function syncWithServer() {
    console.log('Synchroniseren met server...');
    // In een echte implementatie zou hier code staan om data te synchroniseren
}

// Controleer notificatie permissies
function checkNotificationPermission() {
    if (!notificationsSupported && !serviceWorkerSupported) {
        console.log('Deze browser ondersteunt geen notificaties');
        return;
    }
    
    if (Notification.permission === 'granted') {
        notificationPermission = true;
        notificationBanner.classList.add('hidden');
    } else if (Notification.permission !== 'denied') {
        notificationBanner.classList.remove('hidden');
    }
    
    // Voor mobiele apparaten, controleer ook service worker status
    if (serviceWorkerSupported && swRegistration) {
        console.log('Service Worker is actief en kan notificaties verzenden');
    }
}

// Vraag toestemming voor notificaties
async function requestNotificationPermission() {
    if (!notificationsSupported && !serviceWorkerSupported) {
        alert('Je browser ondersteunt geen notificaties. Probeer een andere browser.');
        return;
    }
    
    try {
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            notificationPermission = true;
            notificationBanner.classList.add('hidden');
            
            // Registreer service worker opnieuw als deze nog niet is geregistreerd
            if (serviceWorkerSupported && !swRegistration) {
                await registerServiceWorker();
            }
            
            showNotification('WasChecker', 'Notificaties zijn nu ingeschakeld!');
        } else if (permission === 'denied') {
            alert('Je hebt notificaties geweigerd. Je kunt dit wijzigen in je browserinstellingen.');
        }
    } catch (error) {
        console.error('Fout bij het aanvragen van notificatie toestemming:', error);
        alert('Er is een fout opgetreden bij het aanvragen van notificatie toestemming. Probeer het opnieuw.');
    }
}

// Toon een notificatie
function showNotification(title, body) {
    if (!notificationPermission) return;
    
    try {
        // Gebruik service worker notificaties als beschikbaar
        if (serviceWorkerSupported && swRegistration) {
            const options = {
                body: body,
                icon: 'favicon.svg',
                vibrate: [100, 50, 100],
                data: {
                    dateOfArrival: Date.now(),
                    primaryKey: 1
                },
                actions: [
                    {action: 'close', title: 'Sluiten'}
                ]
            };
            
            swRegistration.showNotification(title, options);
        } else {
            // Fallback naar standaard notificaties
            const notification = new Notification(title, {
                body: body,
                icon: 'favicon.svg'
            });
            
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        }
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
    let uiNeedsUpdate = false;
    
    washers.forEach(washer => {
        if (washer.completed) return;
        
        // Bereken resterende tijd
        const timeLeft = washer.endTime - now;
        
        if (timeLeft <= 0) {
            // Wasmachine is klaar
            washer.remainingSeconds = 0;
            washer.completed = true;
            updated = true;
            uiNeedsUpdate = true;
            
            // Stuur notificatie als dat nog niet is gebeurd
            if (!washer.notified) {
                showNotification(
                    'Wasmachine klaar', 
                    `${washer.name} is klaar met wassen`
                );
                washer.notified = true;
            }
        } else {
            // Update resterende tijd
            const newRemainingSeconds = Math.ceil(timeLeft / 1000);
            
            // Alleen updaten als de seconden echt veranderd zijn
            if (newRemainingSeconds !== washer.remainingSeconds) {
                washer.remainingSeconds = newRemainingSeconds;
                updated = true;
                
                // Alleen UI updaten als de weergegeven tijd verandert (elke seconde is niet nodig)
                if (Math.floor(washer.remainingSeconds % 60) === 0 || washer.remainingSeconds <= 60) {
                    uiNeedsUpdate = true;
                }
            }
            
            // Controleer of de wasmachine halverwege is
            const halfwayPoint = washer.totalSeconds / 2;
            const elapsedSeconds = washer.totalSeconds - washer.remainingSeconds;
            
            if (elapsedSeconds >= halfwayPoint && !washer.halfwayNotified) {
                showNotification(
                    'Wasmachine halverwege',
                    `${washer.name} is halverwege het wasprogramma`
                );
                washer.halfwayNotified = true;
            }
            
            // Controleer of er nog 10 minuten resteren
            const tenMinutesInSeconds = 10 * 60;
            if (washer.remainingSeconds <= tenMinutesInSeconds && !washer.tenMinutesNotified) {
                showNotification(
                    'Nog 10 minuten te gaan',
                    `${washer.name} is over 10 minuten klaar`
                );
                washer.tenMinutesNotified = true;
            }
        }
    });
    
    // Update UI alleen als er iets is veranderd dat zichtbaar is voor de gebruiker
    if (uiNeedsUpdate) {
        renderWashers();
    }
    
    // Sla gegevens op als er iets is veranderd
    if (updated) {
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

// Open IndexedDB database
async function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('waschecker-db', 1);
        
        request.onerror = event => {
            console.error('IndexedDB error:', event.target.error);
            reject(event.target.error);
        };
        
        request.onsuccess = event => {
            db = event.target.result;
            console.log('Database geopend');
            resolve(db);
        };
        
        request.onupgradeneeded = event => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains('washers')) {
                const store = database.createObjectStore('washers', { keyPath: 'id' });
                store.createIndex('by_endTime', 'endTime', { unique: false });
                console.log('Object store aangemaakt');
            }
        };
    });
}

// Sla wasmachines op in IndexedDB
async function saveWashers() {
    if (!db) {
        console.error('Database is niet geopend');
        return;
    }
    
    try {
        const transaction = db.transaction(['washers'], 'readwrite');
        const store = transaction.objectStore('washers');
        
        // Verwijder alle bestaande wasmachines
        await clearAllWashers(store);
        
        // Voeg alle wasmachines toe
        for (const washer of washers) {
            store.put(washer);
        }
        
        // Trigger background sync als online
        if (navigator.onLine && swRegistration && 'SyncManager' in window) {
            try {
                await swRegistration.sync.register('sync-washers');
            } catch (error) {
                console.error('Fout bij het registreren van sync:', error);
            }
        }
        
        console.log('Wasmachines opgeslagen in IndexedDB');
    } catch (error) {
        console.error('Fout bij het opslaan van wasmachines:', error);
        
        // Fallback naar localStorage als IndexedDB faalt
        try {
            localStorage.setItem('washers', JSON.stringify(washers));
            console.log('Wasmachines opgeslagen in localStorage (fallback)');
        } catch (localStorageError) {
            console.error('Fout bij het opslaan in localStorage:', localStorageError);
        }
    }
}

// Verwijder alle wasmachines uit de store
function clearAllWashers(store) {
    return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = event => reject(event.target.error);
    });
}

// Laad wasmachines uit IndexedDB
async function loadWashers() {
    if (!db) {
        console.error('Database is niet geopend');
        return;
    }
    
    try {
        const transaction = db.transaction(['washers'], 'readonly');
        const store = transaction.objectStore('washers');
        const request = store.getAll();
        
        request.onsuccess = event => {
            const loadedWashers = event.target.result;
            if (loadedWashers && loadedWashers.length > 0) {
                washers = loadedWashers;
                console.log(`${washers.length} wasmachines geladen uit IndexedDB`);
                renderWashers();
            } else {
                // Probeer te laden uit localStorage als fallback
                loadFromLocalStorage();
            }
        };
        
        request.onerror = event => {
            console.error('Fout bij het laden van wasmachines uit IndexedDB:', event.target.error);
            // Probeer te laden uit localStorage als fallback
            loadFromLocalStorage();
        };
    } catch (error) {
        console.error('Fout bij het laden van wasmachines:', error);
        // Probeer te laden uit localStorage als fallback
        loadFromLocalStorage();
    }
}

// Laad wasmachines uit localStorage (fallback)
function loadFromLocalStorage() {
    try {
        const savedWashers = localStorage.getItem('washers');
        if (savedWashers) {
            washers = JSON.parse(savedWashers);
            console.log(`${washers.length} wasmachines geladen uit localStorage (fallback)`);
            renderWashers();
            
            // Migreer naar IndexedDB
            if (db) {
                saveWashers();
            }
        } else {
            washers = [];
            renderWashers();
        }
    } catch (error) {
        console.error('Fout bij het laden van wasmachines uit localStorage:', error);
        washers = [];
        renderWashers();
    }
}