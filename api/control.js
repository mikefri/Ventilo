import axios from 'axios';
import crypto from 'crypto-js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { action, accessId, accessSecret, deviceId, code, value } = req.body || {};
    const t = Date.now().toString();
    const baseUrl = "https://openapi.tuyawen.com";
   
    const signRequest = (method, path, body = '', token = '') => {
        const contentHash = crypto.SHA256(body).toString();
        const stringToSign = [method, contentHash, "", path].join("\n");
        const signStr = accessId + token + t + stringToSign;
        return crypto.HmacSHA256(signStr, accessSecret).toString().toUpperCase();
    };

    try {
        const tokenPath = "/v1.0/token?grant_type=1";
        const tokenSign = signRequest("GET", tokenPath);
        const tokenResponse = await axios.get(`${baseUrl}${tokenPath}`, {
            headers: { 'client_id': accessId, 'sign': tokenSign, 't': t, 'sign_method': 'HMAC-SHA256' }
        });

        // Si l'auth échoue, on renvoie l'erreur exacte de Tuya
        if (!tokenResponse.data.success) {
            return res.json({ success: false, msg: "Tuya Refuse l'accès", detail: tokenResponse.data });
        }

        const accessToken = tokenResponse.data.result.access_token;

        let path = (action === 'listDevices') ? "/v1.0/iot-01/associated-users/devices?size=50" : `/v1.0/devices/${deviceId}/commands`;
        let method = (action === 'listDevices') ? "GET" : "POST";
        let body = (action === 'listDevices') ? "" : JSON.stringify({ commands: [{ code, value }] });

        const sign = signRequest(method, path, body, accessToken);
        const result = await axios({
            method,
            url: `${baseUrl}${path}`,
            headers: {
                'client_id': accessId, 'access_token': accessToken,
                'sign': sign, 't': t, 'sign_method': 'HMAC-SHA256', 'Content-Type': 'application/json'
            },
            data: body
        });

        return res.json(result.data);
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
