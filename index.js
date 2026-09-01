import { makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage, jidDecode } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import chalk from 'chalk';
import NodeCache from 'node-cache';
import fs from 'fs';
import path from 'path';

// Imports des modules
import { handleMainCommands } from './src/commands/main.js';
import { handleOwnerCommands } from './src/commands/owner.js';
import { handleToolsCommands } from './src/commands/tools.js';
import { handleSecurityCommands, config, messageStore, handleSecurityUpsert } from './src/commands/security.js';
import { handleGroupCommands } from './src/commands/group.js';

const PREFIX = '.';
const msgRetryCounterCache = new NodeCache();

// ⚠️ REMPLACE CE NUMÉRO PAR TON NUMÉRO WHATSAPP (AVEC INDICATIF SANS LE +)
const PHONE_NUMBER = "24177000000"; 
const USE_PAIRING_CODE = true; // Passe à false si tu veux revenir au QR Code

// Dossier de stockage local sur l'hébergeur pour l'Anti-Delete
const DELETED_DIR = './deleted_messages';
if (!fs.existsSync(DELETED_DIR)) fs.mkdirSync(DELETED_DIR, { recursive: true });

// --- STORE MÉMOIRE PERSISTANT ---
const STORE_FILE = './baileys_store.json';
const customStore = {
    messages: new Map(),
    
    bind(ev) {
        ev.on('messages.upsert', ({ messages }) => {
            for (const msg of messages) {
                if (msg.key && msg.key.id) {
                    this.messages.set(msg.key.id, msg);
                }
            }
        });
    },

    loadMessage(id) {
        return this.messages.get(id) || null;
    },

    saveToFile() {
        try {
            const data = Array.from(this.messages.entries());
            fs.writeFileSync(STORE_FILE, JSON.stringify(data));
        } catch (e) {
            console.error('Erreur sauvegarde store:', e.message);
        }
    },

    readFromFile() {
        try {
            if (fs.existsSync(STORE_FILE)) {
                const raw = fs.readFileSync(STORE_FILE, 'utf-8');
                const data = JSON.parse(raw);
                this.messages = new Map(data);
            }
        } catch (e) {
            console.error('Erreur lecture store:', e.message);
        }
    }
};

// Chargement initial du store & sauvegarde automatique
customStore.readFromFile();
setInterval(() => customStore.saveToFile(), 10_000);

// --- GESTIONNAIRE DE FILE D'ATTENTE (SÉCURISATION ANTI-CRASH) ---
class CommandQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }

    push(task) {
        this.queue.push(task);
        this.processNext();
    }

    async processNext() {
        if (this.processing || this.queue.length === 0) return;
        
        this.processing = true;
        const task = this.queue.shift();

        try {
            await task();
        } catch (err) {
            console.error(chalk.red('[QUEUE ERROR] Erreur d\'exécution :'), err.message);
        } finally {
            this.processing = false;
            setTimeout(() => this.processNext(), 300);
        }
    }
}

const commandQueue = new CommandQueue();

// Helper pour décoder proprement les JID WhatsApp
const decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
        const decode = jidDecode(jid) || {};
        return (decode.user && decode.server && `${decode.user}@${decode.server}`) || jid;
    }
    return jid;
};

async function startChristina() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !USE_PAIRING_CODE,
        auth: state,
        browser: ['Mac OS', 'Chrome', '120.0.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
        msgRetryCounterCache,
        
        getMessage: async (key) => {
            const msg = customStore.loadMessage(key.id) || messageStore.get(key.id);
            if (msg) return msg.message;
            return { conversation: '' };
        }
    });

    // Génération du Pairing Code si le compte n'est pas encore lié
    if (USE_PAIRING_CODE && !sock.authState.creds.registered) {
        setTimeout(async () => {
            let code = await sock.requestPairingCode(PHONE_NUMBER.trim());
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(chalk.black.bgGreen(`\n========================================`));
            console.log(chalk.black.bgGreen(` VOTRE CODE DE CONNEXION : ${code} `));
            console.log(chalk.black.bgGreen(`========================================\n`));
        }, 3000);
    }

    customStore.bind(sock.ev);
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr && !USE_PAIRING_CODE) {
            console.log(chalk.cyan('\n=== SCANNE CE QR CODE AVEC WHATSAPP ===\n'));
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (statusCode === DisconnectReason.loggedOut) {
                console.log(chalk.yellow('⚠️ Session déconnectée. Supprime auth_info et rescanne.'));
            } else if (shouldReconnect) {
                setTimeout(() => startChristina(), 3000);
            }
        } else if (connection === 'open') {
            console.log(chalk.green('\n👑 GOD ENRICK BOT EST CONNECTÉ ET PRÊT !\n'));
        }
    });

    // =========================================================================
    // 🚨 ANTI-DELETE AUTOMATIQUE ET PERMANENT (SANS PLANTE NETWORK)
    // =========================================================================
    sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            const updateData = update.update;
            const deletedId = update.key.id;

            const isMessageNull = updateData?.message === null;
            const isProtocolRevoke = updateData?.protocolMessage?.type === 0 || updateData?.protocolMessage?.type === 14;
            const isStubRevoke = updateData?.messageStubType === 68 || updateData?.messageStubType === 69;

            if (isMessageNull || isProtocolRevoke || isStubRevoke) {
                const storedMsg = customStore.loadMessage(deletedId) || messageStore.get(deletedId);

                if (!storedMsg || !storedMsg.message || storedMsg.key.fromMe) continue;

                console.log(chalk.red(`[ANTI-DELETE] Suppression détectée pour l'ID : ${deletedId}`));

                const senderJid = storedMsg.key.participant || storedMsg.key.remoteJid;
                const senderNumber = senderJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
                const fromGroup = storedMsg.key.remoteJid.endsWith('@g.us') ? 'Groupe' : 'Discussion Privée';
                const ownerJid = decodeJid(sock.user.id);

                const headerInfo = `🗑️ *MESSAGE SUPPRIMÉ DÉTECTÉ*\n\n` +
                                   `👤 *Expéditeur :* @${senderNumber}\n` +
                                   `📍 *Source :* ${fromGroup}\n` +
                                   `⏰ *Heure :* ${new Date().toLocaleTimeString()}\n` +
                                   `────────────────────────`;

                try {
                    const msgContent = storedMsg.message;
                    const textContent = msgContent.conversation || msgContent.extendedTextMessage?.text;
                    const isMedia = msgContent.imageMessage || msgContent.videoMessage || msgContent.audioMessage || msgContent.stickerMessage || msgContent.documentMessage;

                    if (textContent) {
                        await sock.sendMessage(ownerJid, {
                            text: `${headerInfo}\n\n💬 *Texte :*\n${textContent}`,
                            mentions: [senderJid]
                        });
                    } else if (isMedia) {
                        let buffer;
                        try {
                            buffer = await downloadMediaMessage(storedMsg, 'buffer', {}, {
                                options: { timeout: 30000 }
                            });
                        } catch (mediaErr) {
                            console.error(chalk.yellow(`[ANTI-DELETE] Média inaccessible (${mediaErr.message}).`));
                            return await sock.sendMessage(ownerJid, {
                                text: `${headerInfo}\n\n⚠️ *Média supprimé non téléchargeable (Problème de réseau serveur).*`,
                                mentions: [senderJid]
                            });
                        }

                        if (msgContent.imageMessage) {
                            await sock.sendMessage(ownerJid, { image: buffer, caption: `${headerInfo}\n🖼️ *Photo supprimée*`, mentions: [senderJid] });
                        } else if (msgContent.videoMessage) {
                            await sock.sendMessage(ownerJid, { video: buffer, caption: `${headerInfo}\n🎥 *Vidéo supprimée*`, mentions: [senderJid] });
                        } else if (msgContent.audioMessage) {
                            await sock.sendMessage(ownerJid, { audio: buffer, mimetype: 'audio/mp4', caption: headerInfo, mentions: [senderJid] });
                        } else if (msgContent.stickerMessage) {
                            await sock.sendMessage(ownerJid, { text: `${headerInfo}\n👇 *Sticker supprimé :*`, mentions: [senderJid] });
                            await sock.sendMessage(ownerJid, { sticker: buffer });
                        } else if (msgContent.documentMessage) {
                            await sock.sendMessage(ownerJid, { 
                                document: buffer, 
                                mimetype: msgContent.documentMessage.mimetype, 
                                fileName: msgContent.documentMessage.fileName || 'fichier', 
                                caption: headerInfo, 
                                mentions: [senderJid] 
                            });
                        }
                    }
                } catch (e) {
                    console.error('Erreur traitement Anti-Delete :', e);
                }
            }
        }
    });

    // =========================================================================
    // 📩 CAPTURE DES MESSAGES ENTRANTS & TRAITEMENT DES COMMANDES
    // =========================================================================
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (!msg || !msg.message) continue;

            if (msg.key && msg.key.id) {
                messageStore.set(msg.key.id, msg);
                customStore.messages.set(msg.key.id, msg);
            }

            // Exécution des événements automatiques (Auto-Statut / Welcome MP)
            await handleSecurityUpsert(sock, msg);

            const remoteJid = msg.key.remoteJid;
            const pushName = msg.pushName || 'GOD Enrick';
            const isOwner = msg.key.fromMe;

            if (config.mode === 'private' && !isOwner) continue;

            const body = msg.message.conversation || 
                         msg.message.extendedTextMessage?.text || 
                         msg.message.imageMessage?.caption || 
                         msg.message.videoMessage?.caption || '';

            if (!body.startsWith(PREFIX)) continue;

            const args = body.slice(PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            // Encapsulation dans la file d'attente pour éviter les crashes lors de commandes simultanées
            commandQueue.push(async () => {
                console.log(chalk.yellow(`[COMMANDE ${isOwner ? 'OWNER' : 'USER'}] ${command} par ${pushName}`));

                await handleMainCommands(sock, remoteJid, command, args, pushName);
                await handleOwnerCommands(sock, remoteJid, command, args, isOwner);
                await handleToolsCommands(sock, msg, remoteJid, command, args);
                await handleSecurityCommands(sock, msg, remoteJid, command, args, isOwner);
                await handleGroupCommands(sock, msg, remoteJid, command, args, isOwner);
            });
        }
    });
}

startChristina();