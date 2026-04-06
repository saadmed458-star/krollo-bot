import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser } from '@whiskeysockets/baileys';
import fs from 'fs-extra';
import pino from 'pino';
import path from 'path';
import chalk from 'chalk';
import readline from 'readline';
import { fileURLToPath, pathToFileURL } from 'url';
import crypto from 'crypto';
import os from 'os';
import delay from 'delay';

import { ensureAccountFiles } from './accounts/accountUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_LOGIN_MODE = process.env.LOGIN_MODE === 'true';
const ACCOUNT_NAME = process.env.ACCOUNT_NAME || 'default';
const DEFAULT_FOLDER = path.resolve(__dirname, 'node_modules', 'default');
const TARGET_FOLDER = process.env.TARGET_FOLDER || path.join(__dirname, 'accounts', ACCOUNT_NAME);
const RESOURCE_DIR = IS_LOGIN_MODE ? DEFAULT_FOLDER : TARGET_FOLDER;

const sessionDir = path.join(__dirname, 'ملف_الاتصال');
const passwordFile = path.join(sessionDir, 'Password.txt'); 
const errorFilePath = path.join(__dirname, 'node_modules', 'axios', 'errorMsg.txt');

const SECRET_KEY = crypto.createHash('sha256').update('jnd_secure_session_v1').digest();

// --- أنظمة التشفير الأصلية ---
function encryptText(text) {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', SECRET_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return iv.toString('base64') + ':' + encrypted;
  } catch (e) { return null; }
}

function decryptTextSafe(text) {
  try {
    const index = text.indexOf(':');
    if (index === -1) return null;
    const ivBase64 = text.slice(0, index);
    const data = text.slice(index + 1);
    const iv = Buffer.from(ivBase64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', SECRET_KEY, iv);
    let decrypted = decipher.update(data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) { return null; }
}

// --- نظام البصمة الرقمية ---
function getSystemFingerprint() {
    try {
        const platform = os.platform();
        const arch = os.arch();
        const user = os.userInfo().username || 'unknown';
        const cpus = os.cpus();
        const cpuModel = cpus.length > 0 ? cpus[0].model : 'generic_cpu';
        const sysData = `${platform}_${arch}_${user}_${cpuModel}`;
        return crypto.createHash('md5').update(sysData).digest('hex');
    } catch (e) { return 'fallback_fingerprint_' + os.arch(); }
}

let handleMessages, initializePlugins, elitePro, config, loginHandler;
let play, playError, playLogout, logger;
let themeData = { asciiArt: '', soundPath: '', themeColor: 'FF6BFF' };

async function bootstrapSystem() {
    if (!IS_LOGIN_MODE && ACCOUNT_NAME !== 'default') {
        ensureAccountFiles(ACCOUNT_NAME);
    }
    try {
        const utilsPath = path.join(RESOURCE_DIR, 'utils');
        const finalUtilsPath = fs.existsSync(path.join(utilsPath, 'console.js')) ? utilsPath : path.join(DEFAULT_FOLDER, 'utils');
        const loggerModule = await import(pathToFileURL(path.join(finalUtilsPath, 'console.js')).href);
        logger = loggerModule.default;
        const soundModule = await import(pathToFileURL(path.join(finalUtilsPath, 'sound.js')).href);
        play = (filePath) => { soundModule.play(filePath); };
        playError = () => { soundModule.playError(); };
        playLogout = () => { soundModule.playLogout(); };
    } catch (e) { logger = console; }

    try {
        const configModule = await import(pathToFileURL(path.join(RESOURCE_DIR, 'nova', 'config.js')).href);
        config = configModule.default;
        const msgsModule = await import(pathToFileURL(path.join(RESOURCE_DIR, 'handlers', 'messages.js')).href);
        handleMessages = msgsModule.handleMessages;
        initializePlugins = msgsModule.initializePlugins;
        const eliteModule = await import(pathToFileURL(path.join(RESOURCE_DIR, 'handlers', 'elite-pro.js')).href);
        elitePro = eliteModule.default;
    } catch (e) {}
}

export async function startBot() {
  await bootstrapSystem();
  try {
    await fs.ensureDir(sessionDir);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      auth: state,
      version,
      printQRInTerminal: false,
      browser: ['Ubuntu', 'Chrome', '20.0.0'],
      logger: pino({ level: 'silent' }),
      markOnlineOnConnect: true,
      syncFullHistory: false
    });

    // --- الحل النهائي لخطأ الـ TypeError ---
    if (!sock.authState.creds.registered) {
      // تحويل الرقم إلى String أولاً لتجنب مشكلة replace
      const phoneNumber = (config?.pairing?.phone || '').toString().replace(/[^0-9]/g, '');
      const pairingPassword = "ANASTASIA"; 

      if (phoneNumber) {
        console.log(chalk.yellow(`⏳ Requesting pairing code for: ${phoneNumber}`));
        setTimeout(async () => {
          try {
            const code = await sock.requestPairingCode(phoneNumber, pairingPassword);
            console.log('\x1b[30m\x1b[43m%s\x1b[0m', `\n\n كود الربط الخاص بك هو: ${code} \n`);
            
            const securityData = JSON.stringify({ password: pairingPassword, fingerprint: getSystemFingerprint() });
            await fs.writeFile(passwordFile, encryptText(securityData));
          } catch (err) {
            console.log(chalk.red("❌ فشل طلب الكود: "), err.message);
          }
        }, 5000);
      } else {
          console.log(chalk.red("❌ لم يتم العثور على رقم هاتف في config.js!"));
      }
    }

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'open') {
        if (logger) logger.success(`CONNECTED! [${ACCOUNT_NAME}]`);
        if(initializePlugins) await initializePlugins(themeData.themeColor);
      }
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        if (statusCode !== DisconnectReason.loggedOut) {
            console.log(chalk.yellow("Connection closed. Reconnecting..."));
            setTimeout(startBot, 5000);
        }
      }
    });

    sock.ev.on('messages.upsert', async (m) => {
        if (handleMessages) await handleMessages(sock, m);
    });

    sock.ev.on('creds.update', saveCreds);

  } catch (err) {
    console.error('Startup Error:', err);
    setTimeout(startBot, 5000);
  }
}

startBot();
