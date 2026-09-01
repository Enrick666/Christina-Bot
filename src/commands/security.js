export const config = {
    mode: 'public',
    welcome: false,
    selectedSug: 2,
    autoStatut: false,
    statutLikesToday: 0,
    lastResetDate: new Date().toDateString()
};

const welcomedContacts = new Set();

const suggestions = {
    1: "Je suis sorti un instant, mais je reviens bientôt ! 🚶‍♂️",
    2: "J'arrive, t'inquiète ! Mais je te préviens tout de suite : je n'ai pas d'argent oh ! 💸",
    3: "Salut ! Si c'est pour me demander de l'argent, sache déjà que je n'en ai pas ! 🙅‍♂️",
    4: "En train de conspirer sur ma propre vie... 🤫 Sinon, qu'est-ce qui t'a poussé à m'écrire ?"
};

export const messageStore = new Map();

const react = async (sock, msg, emoji) => {
    try {
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: emoji, key: msg.key }
        });
    } catch (err) {}
};

const checkDailyReset = () => {
    const today = new Date().toDateString();
    if (config.lastResetDate !== today) {
        config.statutLikesToday = 0;
        config.lastResetDate = today;
    }
};

export const handleSecurityCommands = async (sock, msg, remoteJid, command, args, isOwner) => {
    switch (command) {
        case 'mode': {
            if (!isOwner) {
                await react(sock, msg, '❌');
                return await sock.sendMessage(remoteJid, { text: '⚠️ *Seul l\'Owner (GOD Enrick) peut modifier le mode.*' }, { quoted: msg });
            }

            const option = args[0]?.toLowerCase();
            if (option === 'public') {
                config.mode = 'public';
                await react(sock, msg, '🌐');
                await sock.sendMessage(remoteJid, { text: '🌐 *Mode passé en : PUBLIC*' }, { quoted: msg });
            } else if (option === 'private') {
                config.mode = 'private';
                await react(sock, msg, '🔒');
                await sock.sendMessage(remoteJid, { text: '🔒 *Mode passé en : PRIVATE*' }, { quoted: msg });
            } else {
                await react(sock, msg, '❓');
                await sock.sendMessage(remoteJid, { text: '⚠️ *Utilisation :* `.mode public` ou `.mode private`' }, { quoted: msg });
            }
            break;
        }

        case 'welcome': {
            const option = args[0]?.toLowerCase();
            if (option === 'on') {
                config.welcome = true;
                welcomedContacts.clear();
                await react(sock, msg, '✅');
                await sock.sendMessage(remoteJid, { 
                    text: `🎉 *Répondeur MP ACTIVÉ !*\n💬 *Suggestion actuelle (${config.selectedSug}) :*\n_"${suggestions[config.selectedSug]}"_\n\nℹ️ _Chaque contact ne recevra le message qu'une seule fois._` 
                }, { quoted: msg });
            } else if (option === 'off') {
                config.welcome = false;
                welcomedContacts.clear();
                await react(sock, msg, '🛑');
                await sock.sendMessage(remoteJid, { text: '🛑 *Répondeur MP DÉSACTIVÉ !*' }, { quoted: msg });
            } else {
                await react(sock, msg, '❓');
                await sock.sendMessage(remoteJid, { text: '⚠️ *Utilisation :* `.welcome on` ou `.welcome off`' }, { quoted: msg });
            }
            break;
        }

        case 'sug': {
            const num = parseInt(args[0], 10);
            if (num >= 1 && num <= 4) {
                config.selectedSug = num;
                await react(sock, msg, '📝');
                await sock.sendMessage(remoteJid, { 
                    text: `✅ *Suggestion ${num} sélectionnée !*\n💬 _"${suggestions[num]}"_` 
                }, { quoted: msg });
            } else {
                await react(sock, msg, '❌');
                await sock.sendMessage(remoteJid, { 
                    text: '⚠️ *Choisis une suggestion de 1 à 4 !*\nExemple : `.sug 1`' 
                }, { quoted: msg });
            }
            break;
        }

        case 'statut': {
            const option = args[0]?.toLowerCase();
            if (option === 'on') {
                config.autoStatut = true;
                await react(sock, msg, '💚');
                await sock.sendMessage(remoteJid, { text: '💚 *Auto-Like & Vue des Statuts ACTIVÉ (Limite : 60/jour).*' }, { quoted: msg });
            } else if (option === 'off') {
                config.autoStatut = false;
                await react(sock, msg, '🛑');
                await sock.sendMessage(remoteJid, { text: '🛑 *Auto-Like des Statuts DÉSACTIVÉ.*' }, { quoted: msg });
            } else {
                await react(sock, msg, '❓');
                await sock.sendMessage(remoteJid, { text: '⚠️ *Utilisation :* `.statut on` ou `.statut off`' }, { quoted: msg });
            }
            break;
        }

        case 'stats': {
            checkDailyReset();
            const statsText = `
📊 *CHRISTINA BOT - DASHBOARD* 📊
──────────────⭓
🔒 *Mode :* \`${config.mode.toUpperCase()}\`
💬 *Welcome MP :* \`${config.welcome ? 'ON (Sug ' + config.selectedSug + ')' : 'OFF'}\`
💚 *Auto-Statut :* \`${config.autoStatut ? 'ON' : 'OFF'}\`
📈 *Likes du jour :* \`${config.statutLikesToday} / 60\`
──────────────⭓
👑 *Owner :* GOD Enrick
`.trim();

            await sock.sendMessage(remoteJid, { text: statsText }, { quoted: msg });
            break;
        }
    }
};
export const handleSecurityUpsert = async (sock, msg) => {
    const remoteJid = msg.key.remoteJid;

    // --- GESTION AUTO-STATUT ---
    if (remoteJid === 'status@broadcast' && config.autoStatut) {
        checkDailyReset();
        if (config.statutLikesToday < 60) {
            const participant = msg.key.participant || msg.participant;
            if (!participant) return;

            // Délai aléatoire entre 3 et 7 secondes pour simuler un humain et éviter le flood réseau
            const delay = Math.floor(Math.random() * 4000) + 3000;

            setTimeout(async () => {
                try {
                    // 1. Marquer comme vu
                    await sock.readMessages([{
                        remoteJid: 'status@broadcast',
                        id: msg.key.id,
                        participant: participant
                    }]);

                    // Petit délai intermédiaire de 1 seconde avant le like
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // 2. Envoyer la réaction
                    await sock.sendMessage('status@broadcast', {
                        react: { text: '💚', key: msg.key }
                    }, { statusJidList: [participant] });

                    config.statutLikesToday++;
                    console.log(`💚 Status de ${participant.split('@')[0]} vu et liké (${config.statutLikesToday}/60)`);
                } catch (err) {
                    // Empêche le crash du bot si le serveur ferme la connexion (ECONNRESET)
                    console.error(`⚠️ [AUTO-STATUT] Échec temporaire pour ${participant.split('@')[0]} : ${err.message}`);
                }
            }, delay);
        }
    }

    // --- GESTION WELCOME MP ---
    if (!msg.key.fromMe && !remoteJid.endsWith('@g.us') && remoteJid !== 'status@broadcast' && config.welcome) {
        if (!welcomedContacts.has(remoteJid)) {
            welcomedContacts.add(remoteJid);
            const text = suggestions[config.selectedSug];
            await sock.sendMessage(remoteJid, { text }, { quoted: msg });
        }
    }
};