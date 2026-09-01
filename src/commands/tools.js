import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, ImageRun } from 'docx';

const execPromise = util.promisify(exec);
process.env.FFMPEG_PATH = ffmpegPath;
ffmpeg.setFfmpegPath(ffmpegPath);

export const react = async (sock, msg, emoji) => {
    try {
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: emoji, key: msg.key }
        });
    } catch (err) {
        console.error('Erreur réaction:', err);
    }
};

export const sendToolsMenu = async (sock, remoteJid, msg) => {
    const menuText = `
👑 *GOD ENRICK BOT - OUTILS & MULTIMÉDIA* 👑

📸 *RÉSEAUX SOCIAUX & TÉLÉCHARGEMENTS*
├ 🎵 *.tiktok* <lien> (ou *.tt*) - Télécharger vidéo TikTok
├ 📸 *.insta* <lien> (ou *.ig*) - Télécharger Reel/Post Instagram
├ 📘 *.fb* <lien> (ou *.facebook*) - Télécharger vidéo Facebook
└ 🐦 *.x* <lien> (ou *.twitter*) - Télécharger vidéo X/Twitter

📄 *DOCUMENTS & CONVERSIONS*
├ 📄 *.pdf* <texte> (ou réponse image) - Créer un PDF
├ 📝 *.word* <texte> (ou *.docx*) - Créer un document Word (.docx)
├ 🖼️ *.toimg* - Sticker en Image JPG
├ 🎵 *.tomp3* (ou *.toaudio*) - Vidéo/Audio en fichier MP3
└ 🎙️ *.tovn* - Audio/Vidéo en Note Vocale (PTT)

🛠️ *UTILITAIRES*
├ 🎨 *.sticker* (ou *.s*) - Créer un sticker depuis image/vidéo
├ 📥 *.save* - Sauvegarder un statut dans ton MP privé
└ 🔓 *.okay* (en réponse) - Intercepter une vue unique

└─ *GOD Enrick Bot 👑*
`.trim();

    await sock.sendMessage(remoteJid, { text: menuText }, { quoted: msg });
};

export const handleToolsCommands = async (sock, msg, remoteJid, command, args) => {
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = contextInfo?.quotedMessage;
    
    let targetMsg = msg;
    if (quotedMsg) {
        targetMsg = {
            message: quotedMsg,
            key: { remoteJid, id: contextInfo.stanzaId }
        };
    }

    // Récupération de ton propre numéro WhatsApp (l'owner / le bot lui-même)
    const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

    switch (command) {
        case 'tools':
        case 'outils': {
            await sendToolsMenu(sock, remoteJid, msg);
            break;
        }

        // ==========================================
        // 📥 SAUVEGARDE DE STATUT (.save -> Ton MP)
        // ==========================================
        case 'save': {
            if (!quotedMsg) {
                await react(sock, msg, '❌');
                return await sock.sendMessage(remoteJid, { 
                    text: '⚠️ *Réponds à un statut (image, vidéo ou texte) avec la commande .save*' 
                });
            }

            await react(sock, msg, '⏳');

            try {
                // 1. Sauvegarde d'une Image
                if (quotedMsg.imageMessage) {
                    const buffer = await downloadMediaMessage(targetMsg, 'buffer', {});
                    await sock.sendMessage(ownerJid, { 
                        image: buffer, 
                        caption: '📥 *Statut Image sauvegardé !*' 
                    });
                }
                // 2. Sauvegarde d'une Vidéo
                else if (quotedMsg.videoMessage) {
                    const buffer = await downloadMediaMessage(targetMsg, 'buffer', {});
                    await sock.sendMessage(ownerJid, { 
                        video: buffer, 
                        caption: '📥 *Statut Vidéo sauvegardé !*' 
                    });
                }
                // 3. Sauvegarde d'un Texte
                else if (quotedMsg.conversation || quotedMsg.extendedTextMessage?.text) {
                    const textContent = quotedMsg.conversation || quotedMsg.extendedTextMessage.text;
                    await sock.sendMessage(ownerJid, { 
                        text: `📥 *Statut Texte sauvegardé :*\n\n${textContent}` 
                    });
                } else {
                    await react(sock, msg, '❌');
                    return await sock.sendMessage(remoteJid, { text: '❌ *Le statut sélectionné n\'est pas pris en charge.*' });
                }

                await react(sock, msg, '✅');
                if (remoteJid !== ownerJid) {
                    await sock.sendMessage(remoteJid, { text: '✅ *Statut envoyé dans ton chat privé !*' }, { quoted: msg });
                }

            } catch (error) {
                console.error('Erreur save:', error);
                await react(sock, msg, '❌');
                await sock.sendMessage(remoteJid, { text: '❌ *Échec de la sauvegarde du statut.*' });
            }
            break;
        }

        // ==========================================
        // 🎨 STICKER (.sticker / .s)
        // ==========================================
        case 'sticker':
        case 's': {
            const isImage = msg.message?.imageMessage || quotedMsg?.imageMessage;
            const isVideo = msg.message?.videoMessage || quotedMsg?.videoMessage;

            if (!isImage && !isVideo) {
                await react(sock, msg, '❌');
                return await sock.sendMessage(remoteJid, { 
                    text: '⚠️ *Envoie ou réponds à une image, un GIF ou une vidéo courte avec la commande .sticker*' 
                });
            }

            await react(sock, msg, '⏳');

            try {
                const buffer = await downloadMediaMessage(targetMsg, 'buffer', {});

                const sticker = new Sticker(buffer, {
                    pack: 'GOD Enrick Bot 👑',
                    author: 'GOD Enrick',
                    type: StickerTypes.FULL,
                    quality: 60
                });

                const stickerBuffer = await sticker.toBuffer();
                await sock.sendMessage(remoteJid, { sticker: stickerBuffer });
                await react(sock, msg, '✅');

            } catch (error) {
                console.error('Erreur sticker:', error);
                await react(sock, msg, '❌');
            }
            break;
        }

        // ==========================================
        // 🖼️ STICKER VERS IMAGE (.toimg)
        // ==========================================
        case 'toimg':
        case 'toimage': {
            const isSticker = msg.message?.stickerMessage || quotedMsg?.stickerMessage;

            if (!isSticker) {
                await react(sock, msg, '❌');
                return await sock.sendMessage(remoteJid, { text: '⚠️ *Réponds à un sticker avec la commande .toimg*' });
            }

            await react(sock, msg, '⏳');

            try {
                const buffer = await downloadMediaMessage(targetMsg, 'buffer', {});
                const tempWebpPath = path.join(os.tmpdir(), `sticker_${Date.now()}.webp`);
                const tempJpgPath = path.join(os.tmpdir(), `img_${Date.now()}.jpg`);

                fs.writeFileSync(tempWebpPath, buffer);

                ffmpeg(tempWebpPath)
                    .toFormat('jpg')
                    .save(tempJpgPath)
                    .on('end', async () => {
                        const imgBuffer = fs.readFileSync(tempJpgPath);
                        await sock.sendMessage(remoteJid, { image: imgBuffer, caption: '✅ *Sticker converti en image !*' }, { quoted: msg });
                        await react(sock, msg, '✅');

                        if (fs.existsSync(tempWebpPath)) fs.unlinkSync(tempWebpPath);
                        if (fs.existsSync(tempJpgPath)) fs.unlinkSync(tempJpgPath);
                    })
                    .on('error', async (err) => {
                        console.error('Erreur conversion toimg:', err);
                        await react(sock, msg, '❌');
                        if (fs.existsSync(tempWebpPath)) fs.unlinkSync(tempWebpPath);
                    });

            } catch (error) {
                console.error('Erreur toimg:', error);
                await react(sock, msg, '❌');
            }
            break;
        }

        // ==========================================
        // 🎵 VIDÉO EN MP3 (.tomp3 / .toaudio)
        // ==========================================
        case 'tomp3':
        case 'toaudio': {
            const isVideo = msg.message?.videoMessage || quotedMsg?.videoMessage;
            const isAudio = msg.message?.audioMessage || quotedMsg?.audioMessage;

            if (!isVideo && !isAudio) {
                await react(sock, msg, '❌');
                return await sock.sendMessage(remoteJid, { text: '⚠️ *Réponds à une vidéo ou une note vocale avec la commande .tomp3*' });
            }

            await react(sock, msg, '⏳');

            try {
                const buffer = await downloadMediaMessage(targetMsg, 'buffer', {});
                const tempInputPath = path.join(os.tmpdir(), `input_${Date.now()}`);
                const tempAudioPath = path.join(os.tmpdir(), `audio_${Date.now()}.mp3`);

                fs.writeFileSync(tempInputPath, buffer);

                ffmpeg(tempInputPath)
                    .audioCodec('libmp3lame')
                    .audioBitrate('128k')
                    .toFormat('mp3')
                    .save(tempAudioPath)
                    .on('end', async () => {
                        const mp3Buffer = fs.readFileSync(tempAudioPath);
                        await sock.sendMessage(remoteJid, { 
                            audio: mp3Buffer, 
                            mimetype: 'audio/mpeg'
                        }, { quoted: msg });

                        await react(sock, msg, '✅');
                        if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
                        if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
                    })
                    .on('error', async (err) => {
                        console.error('Erreur conversion tomp3:', err);
                        await react(sock, msg, '❌');
                        if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
                    });

            } catch (error) {
                console.error('Erreur tomp3:', error);
                await react(sock, msg, '❌');
            }
            break;
        }

        // ==========================================
        // 🎙️ AUDIO/VIDÉO EN NOTE VOCALE (.tovn)
        // ==========================================
        case 'tovn': {
            const isAudio = msg.message?.audioMessage || quotedMsg?.audioMessage;
            const isVideo = msg.message?.videoMessage || quotedMsg?.videoMessage;

            if (!isAudio && !isVideo) {
                await react(sock, msg, '❌');
                return await sock.sendMessage(remoteJid, { text: '⚠️ *Réponds à un fichier audio ou une vidéo avec la commande .tovn*' });
            }

            await react(sock, msg, '⏳');

            try {
                const buffer = await downloadMediaMessage(targetMsg, 'buffer', {});
                const tempInputPath = path.join(os.tmpdir(), `input_${Date.now()}`);
                const tempOpusPath = path.join(os.tmpdir(), `vn_${Date.now()}.opus`);

                fs.writeFileSync(tempInputPath, buffer);

                // Paramètres optimisés spécifiquement pour la lecture de note vocale WhatsApp
                ffmpeg(tempInputPath)
                    .audioCodec('libopus')
                    .audioChannels(1)
                    .audioFrequency(48000)
                    .toFormat('opus')
                    .save(tempOpusPath)
                    .on('end', async () => {
                        const opusBuffer = fs.readFileSync(tempOpusPath);
                        await sock.sendMessage(remoteJid, { 
                            audio: opusBuffer, 
                            mimetype: 'audio/ogg; codecs=opus', 
                            ptt: true 
                        }, { quoted: msg });

                        await react(sock, msg, '✅');
                        if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
                        if (fs.existsSync(tempOpusPath)) fs.unlinkSync(tempOpusPath);
                    })
                    .on('error', async (err) => {
                        console.error('Erreur conversion tovn:', err);
                        await react(sock, msg, '❌');
                        if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
                    });

            } catch (error) {
                console.error('Erreur tovn:', error);
                await react(sock, msg, '❌');
            }
            break;
        }

        // ==========================================
        // 🔓 VUE UNIQUE (OKAY)
        // ==========================================
        case 'okay': {
            const quotedInfo = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            
            if (!quotedInfo) {
                await react(sock, msg, '❌');
                return await sock.sendMessage(remoteJid, { 
                    text: '⚠️ *Réponds à un message à vue unique avec la commande .okay*' 
                });
            }

            const viewOnceMedia = quotedInfo.viewOnceMessageV2?.message || 
                                  quotedInfo.viewOnceMessage?.message || 
                                  quotedInfo.viewOnceMessageV2Extension?.message ||
                                  (quotedInfo.imageMessage?.viewOnce ? quotedInfo : null) ||
                                  (quotedInfo.videoMessage?.viewOnce ? quotedInfo : null);

            if (!viewOnceMedia) {
                await react(sock, msg, '❌');
                return await sock.sendMessage(remoteJid, { 
                    text: '⚠️ *Le message sélectionné n\'est pas détecté comme une vue unique.*' 
                });
            }

            await react(sock, msg, '🔓');

            try {
                const isImage = viewOnceMedia.imageMessage;
                const isVideo = viewOnceMedia.videoMessage;
                const targetObj = { message: viewOnceMedia };

                const buffer = await downloadMediaMessage(targetObj, 'buffer', {});

                if (isImage) {
                    await sock.sendMessage(ownerJid, { 
                        image: buffer, 
                        caption: `👑 *Vue unique interceptée depuis le chat :* ${remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '')}` 
                    });
                } else if (isVideo) {
                    await sock.sendMessage(ownerJid, { 
                        video: buffer, 
                        caption: `👑 *Vidéo vue unique interceptée depuis le chat :* ${remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '')}` 
                    });
                }

                await react(sock, msg, '✅');

            } catch (error) {
                console.error('Erreur vue unique:', error);
                await react(sock, msg, '❌');
            }
            break;
        }

        // ==========================================
        // 🎵 TIKTOK
        // ==========================================
        case 'tiktok':
        case 'tt': {
            const url = args[0];
            if (!url || !url.includes('tiktok.com')) {
                await react(sock, msg, '❌');
                return await sock.sendMessage(remoteJid, { text: '⚠️ *Fournis un lien TikTok valide !*' });
            }

            await react(sock, msg, '🎵');
            try {
                const tempPath = path.join(os.tmpdir(), `${Date.now()}.mp4`);
                await execPromise(`yt-dlp --no-check-certificate -o "${tempPath}" "${url}"`);

                if (fs.existsSync(tempPath)) {
                    await sock.sendMessage(remoteJid, {
                        video: fs.readFileSync(tempPath),
                        caption: `👑 *Téléchargement TikTok réussi !*`
                    }, { quoted: msg });
                    fs.unlinkSync(tempPath);
                    await react(sock, msg, '✅');
                }
            } catch (error) {
                console.error('Erreur TikTok:', error);
                await react(sock, msg, '❌');
            }
            break;
        }

        // ==========================================
        // 📸 INSTAGRAM
        // ==========================================
        case 'insta':
        case 'ig': {
            const url = args[0];
            if (!url || !url.includes('instagram.com')) {
                await react(sock, msg, '❌');
                return await sock.sendMessage(remoteJid, { text: '⚠️ *Fournis un lien Instagram valide !*' });
            }

            await react(sock, msg, '📸');
            try {
                const tempPath = path.join(os.tmpdir(), `${Date.now()}.mp4`);
                await execPromise(`yt-dlp --no-check-certificate -o "${tempPath}" "${url}"`);

                if (fs.existsSync(tempPath)) {
                    await sock.sendMessage(remoteJid, {
                        video: fs.readFileSync(tempPath),
                        caption: `👑 *Téléchargement Instagram réussi !*`
                    }, { quoted: msg });
                    fs.unlinkSync(tempPath);
                    await react(sock, msg, '✅');
                }
            } catch (error) {
                console.error('Erreur Instagram:', error);
                await react(sock, msg, '❌');
            }
            break;
        }

        // ==========================================
        // 📘 FACEBOOK
        // ==========================================
        case 'fb':
        case 'facebook': {
            const url = args[0];
            if (!url || (!url.includes('facebook.com') && !url.includes('fb.watch'))) {
                await react(sock, msg, '❌');
                return await sock.sendMessage(remoteJid, { text: '⚠️ *Fournis un lien Facebook valide !*' });
            }

            await react(sock, msg, '📘');
            try {
                const tempPath = path.join(os.tmpdir(), `${Date.now()}.mp4`);
                await execPromise(`yt-dlp --no-check-certificate -o "${tempPath}" "${url}"`);

                if (fs.existsSync(tempPath)) {
                    await sock.sendMessage(remoteJid, {
                        video: fs.readFileSync(tempPath),
                        caption: `👑 *Téléchargement Facebook réussi !*`
                    }, { quoted: msg });
                    fs.unlinkSync(tempPath);
                    await react(sock, msg, '✅');
                }
            } catch (error) {
                console.error('Erreur Facebook:', error);
                await react(sock, msg, '❌');
            }
            break;
        }

        // ==========================================
        // 🐦 X / TWITTER
        // ==========================================
        case 'x':
        case 'twitter': {
            const url = args[0];
            if (!url || (!url.includes('twitter.com') && !url.includes('x.com'))) {
                await react(sock, msg, '❌');
                return await sock.sendMessage(remoteJid, { text: '⚠️ *Fournis un lien X/Twitter valide !*' });
            }

            await react(sock, msg, '🐦');
            try {
                const tempPath = path.join(os.tmpdir(), `${Date.now()}.mp4`);
                await execPromise(`yt-dlp --no-check-certificate -o "${tempPath}" "${url}"`);

                if (fs.existsSync(tempPath)) {
                    await sock.sendMessage(remoteJid, {
                        video: fs.readFileSync(tempPath),
                        caption: `👑 *Téléchargement X/Twitter réussi !*`
                    }, { quoted: msg });
                    fs.unlinkSync(tempPath);
                    await react(sock, msg, '✅');
                }
            } catch (error) {
                console.error('Erreur X:', error);
                await react(sock, msg, '❌');
            }
            break;
        }

        // ==========================================
        // 📄 PDF
        // ==========================================
        case 'pdf': {
            const textContent = args.join(' ');
            const isImage = msg.message?.imageMessage || quotedMsg?.imageMessage;

            if (!textContent && !isImage) {
                await react(sock, msg, '❌');
                return await sock.sendMessage(remoteJid, { 
                    text: '⚠️ *Fournis du texte ou réponds à une image avec la commande .pdf*' 
                });
            }

            await react(sock, msg, '📄');

            try {
                const doc = new PDFDocument();
                const tempPath = path.join(os.tmpdir(), `${Date.now()}.pdf`);
                const stream = fs.createWriteStream(tempPath);
                doc.pipe(stream);

                if (isImage) {
                    const buffer = await downloadMediaMessage(targetMsg, 'buffer', {});
                    doc.image(buffer, { fit: [500, 700], align: 'center', valign: 'center' });
                } else {
                    doc.fontSize(14).text(textContent, 100, 100);
                }

                doc.end();

                stream.on('finish', async () => {
                    await sock.sendMessage(remoteJid, {
                        document: fs.readFileSync(tempPath),
                        mimetype: 'application/pdf',
                        fileName: `Document_${Date.now()}.pdf`
                    }, { quoted: msg });

                    fs.unlinkSync(tempPath);
                    await react(sock, msg, '✅');
                });

            } catch (error) {
                console.error('Erreur PDF:', error);
                await react(sock, msg, '❌');
            }
            break;
        }

        // ==========================================
        // 📝 WORD (.docx)
        // ==========================================
        case 'word':
        case 'docx': {
            const textContent = args.join(' ');
            const isImage = msg.message?.imageMessage || quotedMsg?.imageMessage;

            if (!textContent && !isImage) {
                await react(sock, msg, '❌');
                return await sock.sendMessage(remoteJid, { 
                    text: '⚠️ *Fournis du texte ou réponds à une image avec la commande .word*' 
                });
            }

            await react(sock, msg, '📝');

            try {
                let children = [];

                if (isImage) {
                    const buffer = await downloadMediaMessage(targetMsg, 'buffer', {});
                    children.push(
                        new Paragraph({
                            children: [
                                new ImageRun({
                                    data: buffer,
                                    transformation: { width: 500, height: 500 }
                                })
                            ]
                        })
                    );
                }

                if (textContent) {
                    children.push(
                        new Paragraph({
                            children: [
                                new TextRun({ text: textContent, size: 24 })
                            ]
                        })
                    );
                }

                const doc = new Document({
                    sections: [{
                        properties: {},
                        children: children
                    }]
                });

                const buffer = await Packer.toBuffer(doc);
                const tempPath = path.join(os.tmpdir(), `${Date.now()}.docx`);
                fs.writeFileSync(tempPath, buffer);

                await sock.sendMessage(remoteJid, {
                    document: fs.readFileSync(tempPath),
                    mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    fileName: `Document_${Date.now()}.docx`
                }, { quoted: msg });

                fs.unlinkSync(tempPath);
                await react(sock, msg, '✅');

            } catch (error) {
                console.error('Erreur Word:', error);
                await react(sock, msg, '❌');
            }
            break;
        }
    }
};