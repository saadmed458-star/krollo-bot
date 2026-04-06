import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser } from '@whiskeysockets/baileys';
import fs from 'fs-extra';
import pino from 'pino';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath, pathToFileURL } from 'url';
import crypto from 'crypto';
import os from 'os';
import delay from 'delay';

import { ensureAccountFiles } from './accounts/accountUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_LOGIN_MODE = process.env.LOGIN_MODE === 'true';
const ACCOUNT_NAME = process.env.ACCOUNT_NAME || 'default';
const TARGET_FOLDER = path.join(__dirname, 'accounts', ACCOUNT_NAME);
const RESOURCE_DIR = IS_LOGIN_MODE ? path.resolve(__dirname, 'node_modules', 'default') : TARGET_FOLDER;

const sessionDir = path.join(__dirname, 'ملف_الاتصال');
const passwordFile = path.join(sessionDir, 'Password.txt'); 
const SECRET_KEY = crypto.createHash('sha256').update('jnd_secure_session_v1').digest();

// --- أنظمة التشفير والبصمة الأصلية ---
function encryptText(text) {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', SECRET_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return iv.toString('base64') + ':' + encrypted;
  } catch (e) { return null; }
}

function getSystemFingerprint() {
    try {
        const sysData = `${os.platform()}_${os.arch()}_${os.userInfo().username}`;
        return crypto.createHash('md5').update(sysData).digest('hex');
    } catch (e) { return 'fallback_' + os.arch(); }
}

export async function startBot() {
  try {
    // 1. تحميل الإعدادات فوراً
    const configPath = pathToFileURL(path.join(RESOURCE_DIR, 'nova', 'config.js')).href;
    const configModule = await import(configPath);
    const config = configModule.default;

    console.log(chalk.cyan(`⚙️ Configuration loaded for [${ACCOUNT_NAME}]`));

    // 2. تحميل الملحقات (Messages & Plugins)
    const msgsModule = await import(pathToFileURL(path.join(RESOURCE_DIR, 'handlers', 'messages.js')).href);
    const { handleMessages, initializePlugins } = msgsModule;

    await fs.ensureDir(sessionDir);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      auth: state,
      version,
      printQRInTerminal: false,
      browser: ['Ubuntu', 'Chrome', '20.0.0'],
      logger: pino({ level: 'silent' }),
      markOnlineOnConnect: true
    });

    // --- منطق الربط (تم إصلاح خطأ الـ TypeError هنا) ---
    if (!sock.authState.creds.registered) {
      // تحويل إجباري لنص String لضمان عمل دالة replace
      const rawPhone = config?.pairing?.phone || ""; 
      const phoneNumber = String(rawPhone).replace(/[^0-9]/g, '');

      if (phoneNumber.length > 5) {
        console.log(chalk.yellow(`⏳ Requesting code for: ${phoneNumber}`));
        setTimeout(async () => {
          try {
            // استخدام الباسورد الافتراضي لنظامك "ANASTASIA"
            const code = await sock.requestPairingCode(phoneNumber, "ANASTASIA");
            console.log('\x1b[30m\x1b[43m%s\x1b[0m', `\n\n كود الربط الخاص بك هو: ${code} \n`);
            
            const securityData = JSON.stringify({ password: "ANASTASIA", fingerprint: getSystemFingerprint() });
            await fs.writeFile(passwordFile, encryptText(securityData));
          } catch (err) {
            console.log(chalk.red("❌ Pairing Error: "), err.message);
          }
        }, 5000);
      } else {
        console.log(chalk.red("❌ خطأ: رقم الهاتف غير صحيح أو مفقود في config.js"));
      }
    }

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'open') {
        console.log(chalk.green.bold(`✅ CONNECTED!`));
        if(initializePlugins) await initializePlugins('FF6BFF');
      }
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        if (statusCode !== DisconnectReason.loggedOut) {
            setTimeout(startBot, 5000);
        }
      }
    });

    sock.ev.on('messages.upsert', async (m) => {
        if (handleMessages) await handleMessages(sock, m);
    });

    sock.ev.on('creds.update', saveCreds);

  } catch (err) {
    console.error(chalk.red('❌ Startup Failure:'), err.message);
    setTimeout(startBot, 10000);
  }
}

startBot();
