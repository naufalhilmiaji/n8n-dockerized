// ContactStore.js
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const FILE = 'contacts.json';

// Load contacts from JSON file
function loadContacts() {
    if (fs.existsSync(FILE)) {
        try {
            return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
        } catch (err) {
            console.error("Failed to read contacts.json:", err);
            return [];
        }
    }
    return [];
}

// Save contacts to JSON file
function saveContacts(contacts) {
    try {
        fs.writeFileSync(FILE, JSON.stringify(contacts, null, 2));
    } catch (err) {
        console.error("Failed to save contacts.json:", err);
    }
}

// Convert WWJS contact → custom object with UUID
function wrapContact(contact, existing = null) {
    return {
        uuid: existing?.uuid || uuidv4(),  // reuse UUID if already exists
        id: contact.id._serialized,
        isMe: contact.isMe,
        isGroup: contact.isGroup,
        name: contact.name || contact.pushname || contact.number,
        number: contact.number,
        isBusiness: contact.isBusiness,
        isMyContact: contact.isMyContact
    };
}

// Sync a single WWJS contact into local cache (no duplicates)
function syncContact(wwjsContact) {
    let stored = loadContacts();
    let existing = stored.find(x => x.id === wwjsContact.id._serialized);

    if (existing) {
        // update existing record
        Object.assign(existing, wrapContact(wwjsContact, existing));
    } else {
        stored.push(wrapContact(wwjsContact));
    }

    saveContacts(stored);
    return stored;
}

// Find UUID by phone number
function getContactUUID(phone) {
    let stored = loadContacts();
    let contact = stored.find(c => c.number === phone);
    return contact ? contact.uuid : null;
}

export { loadContacts, saveContacts, syncContact, getContactUUID };
