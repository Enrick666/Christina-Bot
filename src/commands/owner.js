const getTargetJid = (msg, args) => {
    if (msg) {
        const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (quotedParticipant) return quotedParticipant;

        const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (mentionedJid && mentionedJid.length > 0) return mentionedJid[0];
    }

    if (args && args[0]) {
        const cleaned = args[0].replace(/[^0-9]/g, '');
        if (cleaned.length >= 8) return `${cleaned}@s.whatsapp.net`;
    }

    return null;
};

export const handleOwnerCommands = async (sock, msg, remoteJid, command, args, isOwner) => {
    // Harmonisation des arguments si msg est manquant
    if (typeof msg === 'string') {
        isOwner = args;
        args = command;
        command = remoteJid;
        remoteJid = msg;
        msg = null;
    }

    const ownerOnlyCommands = ['restart', 'block', 'unblock'];
    
    if (ownerOnlyCommands.includes(command) && !isOwner) {
        await sock.sendMessage(remoteJid, { text: '❌ *Accès refusé :* Reservé à GOD Enrick.' }, msg ? { quoted: msg } : {});
        return;
    }

    switch (command) {
        case 'restart': {
            await sock.sendMessage(remoteJid, { text: '🔄 *Redémarrage de Christina Bot en cours...*' }, msg ? { quoted: msg } : {});
            setTimeout(() => {
                process.exit(0);
            }, 1000);
            break;
        }

        case 'block': {
            let target = getTargetJid(msg, args);
            if (!target) {
                return await sock.sendMessage(remoteJid, { 
                    text: '⚠️ *Indique un numéro (ex: .block 24165833438) ou réponds au message de la personne.*' 
                }, msg ? { quoted: msg } : {});
            }

            try {
                // Résolution du PN JID / LID auprès des serveurs WhatsApp
                const [result] = await sock.onWhatsApp(target);
                if (!result || !result.exists) {
                    return await sock.sendMessage(remoteJid, { text: '❌ *Ce numéro n\'est pas enregistré sur WhatsApp.*' }, msg ? { quoted: msg } : {});
                }

                // Utilisation du JID validé par WhatsApp
                const resolvedJid = result.jid;
                await sock.updateBlockStatus(resolvedJid, 'block');
                await sock.sendMessage(remoteJid, { 
                    text: `🚫 *Utilisateur bloqué :* @${resolvedJid.split('@')[0]}`, 
                    mentions: [resolvedJid] 
                }, msg ? { quoted: msg } : {});
            } catch (err) {
                console.error('Erreur blocage :', err);
                await sock.sendMessage(remoteJid, { text: '❌ *Échec du blocage.*' }, msg ? { quoted: msg } : {});
            }
            break;
        }

        case 'unblock': {
            let target = getTargetJid(msg, args);
            if (!target) {
                return await sock.sendMessage(remoteJid, { 
                    text: '⚠️ *Indique un numéro (ex: .unblock 24165833438) ou réponds au message de la personne.*' 
                }, msg ? { quoted: msg } : {});
            }

            try {
                // Résolution du PN JID / LID auprès des serveurs WhatsApp
                const [result] = await sock.onWhatsApp(target);
                if (!result || !result.exists) {
                    return await sock.sendMessage(remoteJid, { text: '❌ *Ce numéro n\'est pas enregistré sur WhatsApp.*' }, msg ? { quoted: msg } : {});
                }

                const resolvedJid = result.jid;
                await sock.updateBlockStatus(resolvedJid, 'unblock');
                await sock.sendMessage(remoteJid, { 
                    text: `✅ *Utilisateur débloqué :* @${resolvedJid.split('@')[0]}`, 
                    mentions: [resolvedJid] 
                }, msg ? { quoted: msg } : {});
            } catch (err) {
                console.error('Erreur déblocage :', err);
                await sock.sendMessage(remoteJid, { text: '❌ *Échec du déblocage.*' }, msg ? { quoted: msg } : {});
            }
            break;
        }
    }
};