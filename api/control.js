import axios from 'axios';
import crypto from 'crypto-js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action, accessId, accessSecret, deviceId, code, value } = req.body || {};
    const t = Date.now().toString();
    const baseUrl = "https://openapi.tuyaeu.com";

    // Fonction de signature corrigée
    const signRequest = (method, path, body = '', token = '') => {
        const contentHash = crypto.SHA256(body).toString();
        const stringToSign = [method, contentHash, "", path].join("\n");
        const signStr = accessId + token + t + stringToSign;
        return crypto.HmacSHA256(signStr, accessSecret).toString().toUpperCase();
    };

    try {
        if (!accessId || !accessSecret) {
            return res.status(400).json({ success: false, msg: "Identifiants manquants" });
        }

        // 1. OBTENTION DU TOKEN
        const tokenPath = "/v1.0/token?grant_type=1";
        const tokenSign = signRequest("GET", tokenPath);
        
        const tokenResponse = await axios.get(`${baseUrl}${tokenPath}`, {
            headers: { 'client_id': accessId, 'sign': tokenSign, 't': t, 'sign_method': 'HMAC-SHA256' }
        });

        if (!tokenResponse.data || !tokenResponse.data.success) {
            return res.status(401).json({ success: false, msg: "Tuya Auth Failed", detail: tokenResponse.data?.msg });
        }

        const accessToken = tokenResponse.data.result.access_token;

        // 2. LOGIQUE DES ACTIONS
        let path = "";
        let method = "GET";
        let body = "";

        if (action === 'listDevices') {
            path = "/v1.0/iot-01/associated-users/devices?size=50";
        } else if (action === 'getStatus') {
            path = `/v1.0/devices/${deviceId}/status`;
        } else if (action === 'sendCommand') {
            path = `/v1.0/devices/${deviceId}/commands`;
            method = "POST";
            body = JSON.stringify({ commands: [{ code, value }] });
        } else {
            return res.json({ success: false, msg: "Action non reconnue" });
        }

        const sign = signRequest(method, path, body, accessToken);
        const config = {
            method,
            url: `${baseUrl}${path}`,
            headers: {
                'client_id': accessId,
                'access_token': accessToken,
                'sign': sign,
                't': t,
                'sign_method': 'HMAC-SHA256',
                'Content-Type': 'application/json'
            },
            data: body
        };

        const result = await axios(config);
        
        // Filtrage spécifique pour la liste
        if (action === 'listDevices' && result.data.success) {
            const fans = result.data.result.devices.filter(d => ['fs', 'cf', 'kj'].includes(d.category));
            return res.json({ success: true, result: fans });
        }

        return res.json(result.data);

    } catch (error) {
        console.error("Erreur Backend:", error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
}
