import { performance } from 'perf_hooks';

const formatUptime = (seconds) => {
    const pad = (s) => (s < 10 ? '0' : '') + s;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${pad(hours)}h ${pad(minutes)}m ${pad(secs)}s`;
};

export const handleMainCommands = async (sock, remoteJid, command, args, pushName) => {
    const start = performance.now();

    switch (command) {
        case 'menu':
        case 'help': {
            const subCategory = args[0]?.toLowerCase();

            if (subCategory === 'group') {
                const groupMenuText = `
👑 *MENU GROUP ADMIN* 👑
──────────────⭓
• \`.kick @user\` : Expulser un membre
• \`.add numéro\` : Ajouter un membre
• \`.promote @user\` : Nommer Admin
• \`.demote @user\` : Rétrograder Admin
• \`.mute\` / \`.unmute\` : Fermer/Ouvrir le groupe
• \`.welcome on/off\` : Activer/Désactiver bienvenue
• \`.setwelcome <texte>\` : Configurer texte de bienvenue
• \`.getwelcome\` : Afficher le texte actuel
• \`.antilink on/off\` : Bloquer les liens d'invitation
• \`.warn @user\` : Avertir un membre (3 = Kick)
• \`.unwarn @user\` : Retirer un avertissement
• \`.hidetag <texte>\` : Notification générale
• \`.tagall\` : Mentions visibles de tous
• \`.poll Q | Opt1 | Opt2\` : Créer un sondage
• \`.link\` / \`.resetlink\` : Obtenir/Réinitialiser le lien
──────────────⭓
`.trim();
                return await sock.sendMessage(remoteJid, { text: groupMenuText });
            }

            if (subCategory === 'security') {
                const securityMenuText = `
🛡️ *MENU SÉCURITÉ & AUTOMATISATION* 🛡️
──────────────⭓
• \`.mode public/private\` : Basculer le mode d'accès
• \`.welcome on/off\` : Répondeur automatique MP
• \`.sug 1-4\` : Choisir la variante de bienvenue MP
• \`.statut on/off\` : Auto-like des statuts WhatsApp
• \`.stats\` : Tableau de bord des paramètres
──────────────⭓
`.trim();
                return await sock.sendMessage(remoteJid, { text: securityMenuText });
            }

            if (subCategory === 'tools') {
                const toolsMenuText = `
🛠️ *MENU OUTILS & MÉDIAS* 🛠️
──────────────⭓
📥 *TÉLÉCHARGEMENTS & SAUVEGARDE*
• \`.tiktok <url>\` : Vidéo TikTok sans filigrane
• \`.yt <url>\` : Vidéo/Audio YouTube
• \`.ig <url>\` : Média / Reel Instagram
• \`.fb <url>\` : Vidéo Facebook
• \`.x <url>\` / \`.twitter <url>\` : Vidéo X / Twitter
• \`.save\` : Enregistrer un statut (image/vidéo) localement

🎨 *CONVERSION & ÉDITION DOCUMENTS*
• \`.sticker\` / \`.s\` : Image/Vidéo en sticker
• \`.toimage\` / \`.toimg\` : Sticker en Image JPG
• \`.pdf <nom_du_fichier>\` : Photo en document PDF
• \`.word <nom_du_fichier>\` : Photo en document Word (.docx)
• \`.tomp3\` / \`.toaudio\` : Vidéo en MP3
• \`.tovn\` : Audio/Vidéo en note vocale
──────────────⭓
`.trim();
                return await sock.sendMessage(remoteJid, { text: toolsMenuText });
            }

            const mainText = `
⚡ *CHRISTINA BOT - MAIN DASHBOARD* ⚡
👋 *Bienvenue ${pushName} !*

👑 *Owner :* GOD Enrick
⚙️ *Préfixe :* \`.\`

📌 *Catégories disponibles :*
👉 \`.menu group\` : Administration de Groupe
👉 \`.menu security\` : Sécurité & Automatisation
👉 \`.menu tools\` : Outils Média, PDF/Word & Save Statut

💡 *Commandes Rapides :*
• \`.ping\` : Tester la latence
• \`.uptime\` : Temps d'activité
• \`.owner\` : Contact du créateur
──────────────⭓
`.trim();

            await sock.sendMessage(remoteJid, { text: mainText });
            break;
        }

        case 'ping': {
            const end = performance.now();
            const latency = Math.round(end - start);
            await sock.sendMessage(remoteJid, { text: `🏓 *Pong !* Latence : \`${latency} ms\`` });
            break;
        }

        case 'uptime':
        case 'runtime': {
            const uptimeText = formatUptime(process.uptime());
            await sock.sendMessage(remoteJid, { text: `⏱️ *Durée d'activité continue :* \`${uptimeText}\`` });
            break;
        }

        case 'owner':
        case 'creator': {
            const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const vcard = 
                'BEGIN:VCARD\n' +
                'VERSION:3.0\n' +
                'FN:GOD Enrick\n' +
                'ORG:Owner Christina Bot;\n' +
                `TEL;type=CELL;type=VOICE;waid=${ownerJid.split('@')[0]}:+${ownerJid.split('@')[0]}\n` +
                'END:VCARD';

            await sock.sendMessage(remoteJid, {
                contacts: {
                    displayName: 'GOD Enrick',
                    contacts: [{ vcard }]
                }
            });
            break;
        }
    }
};