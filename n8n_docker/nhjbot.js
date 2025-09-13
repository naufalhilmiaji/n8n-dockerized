import axios from 'axios';
import qr from 'qrcode';
import Whatsapp from 'whatsapp-web.js'
import fs from 'fs'

import { loadContacts, saveContacts, syncContact, getContactUUID } from './saveContacts.js';
// import GroupChat from 'whatsapp-web.js/src/structures/GroupChat.js'

const { Client, LocalAuth, MessageMedia } = Whatsapp

import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create client with manual auth and controlled Chromium dir
const wwebVersion = '2.3000.1018760126-alpha';
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'monalisa' }),
    puppeteer: {
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-extensions',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-application-cache',
            '--disable-session-storage',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-sync',
            '--disable-gpu',
            '--disk-cache-size=0',
            '--media-cache-size=0',
            '--disk-cache-size=104857600',  // 100MB
            '--media-cache-size=10485760'   // 10MB
        ],
    },
    webVersionCache: {
        type: 'remote',
        remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${wwebVersion}.html`,
    },
    takeoverOnConflict: true,
    takeoverTimeoutMs: 0,
});

const filepath = "./wa_authentication.png"
async function safeReply(message, content, options = {}) {
    try {
        await message.reply(content, null, options);
    } catch (err) {
        if (err.message.includes('serialize')) {
            console.warn('Quote serialization failed; retrying without quotedMessageId.');
            delete options.quotedMessageId;
            await message.reply(content, null, options);
        } else {
            throw err;
        }
    }
}

async function isBotMentioned(message, client) {
    const botUser = client.info.wid.user; // e.g. "6281292555532"

    for (const mid of message.mentionedIds || []) {
        try {
            // Attempt to resolve the mention JID to a contact
            const contact = await client.getContactById(mid);
            if (contact?.id?.user === botUser) {
                return true;
            }
        } catch (e) {
            // Could not resolve; skip
            console.warn('Failed to resolve mentioned ID', mid, e.message);
        }
    }
    return false;
}

client.on('qr', dt => {
    console.log('QR Code received, generating image...');
    qr.toFile(filepath, dt, function (err, code) {
        if (err) return console.log(`Error:\n${err}`);
    })
});

client.on('authenticated', () => {
    if (fs.existsSync(filepath)) {
        fs.unlink(filepath, (err) => {
            if (err) throw err;
        });
    } else {
        console.log(`[JS Authentication] You have already authenticated.`);
    }
})

client.on('auth_failure', (msg) => {
    console.error('AUTH FAILED', msg);
});

client.on('ready', () => {
    console.log('Client is ready.');
});

client.on('message', async (message) => {
    const chat = await message.getChat()
    const contact = await message.getContact()

    try {
        if (message.hasQuotedMsg) {
            try {
                console.log('Quoted message ID:', message._data.quotedStanzaID);
            } catch (err) {
                console.error('⚠️ Could not get quoted message:', err.message);
            }
        } else {
            console.log('ℹ️ This message does not quote another one.');
        }

        const synced = syncContact(contact);

        console.log(`Now tracking ${synced.length} contacts...`);
    } catch (err) {
        console.error('Error processing message:', err.message);
    }

    const UUID = getContactUUID(contact.number)
    if (message.body && message.body != '') {
        if (message.body === '!logout') {
            client.logout()
        }

        let groupChat = (chat.isGroup ? "Group" : "Personal")
        console.log(`[WA - ${groupChat} | ${chat.id._serialized} ${chat.name} A message was received from ${contact.pushname}:\n>> ${message.body}`)

        let media
        if (message.hasMedia) {
            media = await message.downloadMedia();
        }

        const sendData = async () => {
            const options = {};
            let quotedMessageId = null;

            if (message.hasQuotedMsg) {
                try {
                    const quotedMessage = await message.getQuotedMessage();

                    // You must not pass the object directly to .reply()
                    quotedMessageId = quotedMessage?.id?._serialized;
                    if (quotedMessageId) {
                        options.quotedMessageId = quotedMessageId;
                    }

                } catch (err) {
                    console.warn('⚠️ Failed to retrieve quoted message:', err.message);
                }
            }

            
            let chat = message.body.replace(/\B@\w+/g, '').trim();

            // Correct the axios post URL to point to your N8N instance.
            // Ensure the protocol (http://) and port (5678) are included.
            // http://localhost:5678/webhook/99e08f0e-9c32-4a7f-b9c6-274e1b1028b1
            const response = await axios.post('http://host.docker.internal:5678/webhook/99e08f0e-9c32-4a7f-b9c6-274e1b1028b1', {
                sessionId: UUID,
                chat: chat
            });

            if (response.status !== 200) {
                console.error('Non-200 response:', response.status, response.data);
                await safeReply(message, "⚠️ Sorry, I'm having trouble connecting to the server. Please try again later.", options);
                return;
            }

            let data = response.data;

            let text = data['output'];
            // let sentiment = data['sentimentAnalysis']['category'];
            // text += `\n\nSentiment: ${sentiment}\n\n— *NHJ Bot*`;

            await safeReply(message, text, options);

            // try {
            //     let chat = message.body.replace(/\B@\w+/g, '').trim();

            //     // Correct the axios post URL to point to your N8N instance.
            //     // Ensure the protocol (http://) and port (5678) are included.
            //     const response = await axios.post('http://host.docker.internal:5678/webhook/acf7f9af-f504-4195-be22-c92e4cd862e9', {
            //         sessionId: UUID,
            //         chat: chat
            //     });
                
            //     let data = response.data[0];
            //     console.log(data)

            //     let text = data['output'];
            //     let sentiment = data['sentimentAnalysis']['category'];
            //     text += `\n\nSentiment: ${sentiment}\n\n— *NHJ Bot*`;

            //     await safeReply(message, text, options);

            // } catch (error) {
            //     if (error.response) {
            //         console.error('Server error:', error.response.data);
            //     } else if (error.request) {
            //         console.error('No response from server:', error.message);
            //     } else {
            //         console.error('Axios error:', error.message);
            //     }
            // }
        };

        // 6281313086172@c.us
        const isPrivate = message.from?.endsWith('@c.us');
        const mentioned = await isBotMentioned(message, client);

        if (mentioned || isPrivate) {
            await sendData();
        }
    }
})

client.initialize();

let shuttingDown = false;
async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log('\nShutting down gracefully...');
    try {
        if (client && client.info) {
            console.log('Destroying WhatsApp client...');
            await client.destroy();
        }
    } catch (err) {
        console.warn('Error destroying client:', err.message);
    }

    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
}

// // Handle CTRL+C and nodemon restarts
process.on('SIGINT', shutdown);   // Ctrl+C
process.on('SIGTERM', shutdown);  // nodemon restarts
