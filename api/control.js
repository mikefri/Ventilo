import { TuyaContext } from '@tuya/tuya-connector-nodejs';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  // On récupère les clés soit du body, soit de l'URL pour le diagnostic
  const accessId = req.body?.accessId || req.query?.accessId;
  const accessSecret = req.body?.accessSecret || req.query?.accessSecret;
  const deviceId = req.body?.deviceId || req.query?.deviceId;
  const action = req.body?.action || req.query?.action;
  const code = req.body?.code || req.query?.code;
  const value = req.body?.value || req.query?.value;

  if (!accessId || !accessSecret) return res.status(400).json({ msg: "Clés manquantes" });

  const tuya = new TuyaContext({
    baseUrl: 'https://openapi.tuyaeu.com',
    accessKey: accessId,
    secretKey: accessSecret,
  });

  try {
    let response;

    if (action === 'listDevices') {
      // Pour lister les appareils (nécessaire pour ton menu déroulant)
      response = await tuya.request({
        path: '/v1.0/iot-01/associated-users/devices?size=50',
        method: 'GET'
      });
    } 
    else if (action === 'sendCommand') {
      response = await tuya.request({
        path: `/v1.0/devices/${deviceId}/commands`,
        method: 'POST',
        body: { "commands": [{ "code": code, "value": value }] }
      });
    } else {
      return res.status(400).json({ success: false, msg: 'Action inconnue' });
    }

    return res.status(200).json(response);

  } catch (error) {
    res.status(500).json({ success: false, msg: error.message });
  }
}
