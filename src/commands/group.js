import fs from 'fs';

const WELCOME_FILE = './welcome_config.json';
const WARNS_FILE = './warns_config.json';
const ANTILINK_FILE = './antilink_config.json';

const loadJSON = (file) => {
    try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (e) {}
    return {};
};

const saveJSON = (file, data) => {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`Erreur sauvegarde ${file}:`, e.message);
    }
};

let welcomeConfig = loadJSON(WELCOME_FILE);
let warnsConfig = loadJSON(WARNS_FILE);
let antilinkConfig = loadJSON(ANTILINK_FILE);

const react = async (sock, msg, emoji) => {
    try {
        await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } });
    } catch (e) {}
};

const getTargetJid = (msg, args) => {
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    if (quotedParticipant) return quotedParticipant;

    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentionedJid && mentionedJid.length > 0) return mentionedJid[0];

    if (args[0]) {
        const cleaned = args[0].replace(/[^0-9]/g, '');
        if (cleaned.length >= 8) return `${cleaned}@s.whatsapp.net`;
    }

    return null;
};

export const handleGroupCommands = async (sock, msg, remoteJid, command, args, isOwner) => {
    if (!remoteJid.endsWith('@g.us')) return;

    try {
        const groupMetadata = await sock.groupMetadata(remoteJid);
        const participants = groupMetadata.participants || [];

        const senderJid = msg.key.participant || remoteJid;
        const senderNumber = senderJid.split(':')[0].split('@')[0];

        // Rétablissement de ton ancienne logique d'admin
        const senderParticipant = participants.find(p => p.id.includes(senderNumber));
        const isUserAdminInGroup = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin';

        const isSenderAdmin = isOwner || isUserAdminInGroup;
        const botNumber = sock.user.id.split(':')[0].split('@')[0];
        const isBotAdmin = isOwner ? true : (participants.find(p => p.id.includes(botNumber))?.admin !== undefined);

        switch (command) {
            case 'tagall':
            case 'hidetag': {
                if (!isSenderAdmin) return;

                const messageText = args.join(' ') || 'Attention tout le monde !';
                const mentions = participants.map(p => p.id);

                if (command === 'tagall') {
                    let text = `📣 *NOTIFICATION GÉNÉRALE*\n📝 *Message :* ${messageText}\n\n`;
                    for (const mem of participants) {
                        text += `@${mem.id.split('@')[0]}\n`;
                    }
                    await sock.sendMessage(remoteJid, { text, mentions }, { quoted: msg });
                } else if (command === 'hidetag') {
                    await sock.sendMessage(remoteJid, { text: messageText, mentions }, { quoted: msg });
                }
                await react(sock, msg, '📢');
                break;
            }

            case 'link':
            case 'linkgroup': {
                try {
                    const inviteCode = await sock.groupInviteCode(remoteJid);
                    const inviteUrl = `https://chat.whatsapp.com/${inviteCode}`;

                    await sock.sendMessage(remoteJid, {
                        text: `🔗 *Lien du groupe :*\n${inviteUrl}`
                    }, { quoted: msg });
                    await react(sock, msg, '🔗');
                } catch (e) {
                    await sock.sendMessage(remoteJid, { 
                        text: '⚠️ *Impossible de récupérer le lien. Assure-toi que le bot est bien administrateur du groupe.*' 
                    }, { quoted: msg });
                }
                break;
            }

            case 'kick': {
                if (!isSenderAdmin || !isBotAdmin) return;
                const target = getTargetJid(msg, args);
                if (!target) return await sock.sendMessage(remoteJid, { text: '⚠️ *Mentionne ou réponds au membre à expulser.*' }, { quoted: msg });

                await sock.groupParticipantsUpdate(remoteJid, [target], 'remove');
                await react(sock, msg, '🚪');
                break;
            }

            case 'add': {
                if (!isSenderAdmin || !isBotAdmin) return;
                const target = getTargetJid(msg, args);
                if (!target) return await sock.sendMessage(remoteJid, { text: '⚠️ *Spécifie le numéro à ajouter.*' }, { quoted: msg });

                await sock.groupParticipantsUpdate(remoteJid, [target], 'add');
                await react(sock, msg, '✅');
                break;
            }

            case 'promote': {
                if (!isSenderAdmin || !isBotAdmin) return;
                const target = getTargetJid(msg, args);
                if (!target) return;
                await sock.groupParticipantsUpdate(remoteJid, [target], 'promote');
                await react(sock, msg, '👑');
                break;
            }

            case 'demote': {
                if (!isSenderAdmin || !isBotAdmin) return;
                const target = getTargetJid(msg, args);
                if (!target) return;
                await sock.groupParticipantsUpdate(remoteJid, [target], 'demote');
                await react(sock, msg, '📉');
                break;
            }

            case 'mute': {
                if (!isSenderAdmin || !isBotAdmin) return;
                await sock.groupSettingUpdate(remoteJid, 'announcement');
                await react(sock, msg, '🔒');
                break;
            }

            case 'unmute': {
                if (!isSenderAdmin || !isBotAdmin) return;
                await sock.groupSettingUpdate(remoteJid, 'not_announcement');
                await react(sock, msg, '🔓');
                break;
            }

            case 'welcome': {
                if (!isSenderAdmin) return;
                const opt = args[0]?.toLowerCase();

                if (!welcomeConfig[remoteJid]) {
                    welcomeConfig[remoteJid] = { enabled: false, text: 'Bienvenue @user dans le groupe *{group}* ! 🎉' };
                }

                if (opt === 'on') {
                    welcomeConfig[remoteJid].enabled = true;
                    saveJSON(WELCOME_FILE, welcomeConfig);
                    await react(sock, msg, '✅');
                    await sock.sendMessage(remoteJid, { text: '🎉 *Bienvenue ACTIVÉ pour ce groupe !*' }, { quoted: msg });
                } else if (opt === 'off') {
                    welcomeConfig[remoteJid].enabled = false;
                    saveJSON(WELCOME_FILE, welcomeConfig);
                    await react(sock, msg, '🛑');
                    await sock.sendMessage(remoteJid, { text: '🛑 *Bienvenue DÉSACTIVÉ pour ce groupe.*' }, { quoted: msg });
                } else {
                    await sock.sendMessage(remoteJid, { text: '⚠️ *Utilisation :* `.welcome on` ou `.welcome off`' }, { quoted: msg });
                }
                break;
            }

            case 'setwelcome': {
                if (!isSenderAdmin) return;
                const customText = args.join(' ');
                if (!customText) return await sock.sendMessage(remoteJid, { text: '⚠️ Indique un texte de bienvenue.' }, { quoted: msg });

                if (!welcomeConfig[remoteJid]) welcomeConfig[remoteJid] = {};
                welcomeConfig[remoteJid].text = customText;
                saveJSON(WELCOME_FILE, welcomeConfig);
                await react(sock, msg, '📝');
                await sock.sendMessage(remoteJid, { text: '✅ *Nouveau message de bienvenue configuré !*' }, { quoted: msg });
                break;
            }
        }
    } catch (err) {
        console.error('Erreur commande groupe :', err);
    }
};