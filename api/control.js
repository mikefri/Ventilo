import { TuyaContext } from '@tuya/tuya-connector-nodejs';

export default async function handler(req, res) {
    // Configuration des headers pour autoriser les requêtes depuis ton interface
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Gestion du pre-flight (CORS)
    if (req.method === 'OPTIONS') return res.status(200).end();

    // Extraction des données envoyées par le navigateur
    const { action, accessId, accessSecret, deviceId, code, value } = req.body || {};

    // Vérification de la présence des clés de configuration
    if (!accessId || !accessSecret) {
        return res.status(400).json({ success: false, msg: "Configuration manquante dans le navigateur." });
    }

    // Initialisation du contexte Tuya avec tes clés privées
    const tuya = new TuyaContext({
        baseUrl: 'https://openapi.tuyaeu.com',
        accessKey: accessId,
        secretKey: accessSecret,
    });

    try {
        let response;

        switch (action) {
            case 'listDevices':
                // Récupère tous les appareils liés au compte
                const rawList = await tuya.request({
                    path: '/v1.0/iot-01/associated-users/devices?size=50',
                    method: 'GET'
                });

                if (rawList.success) {
                    const allDevices = rawList.result.devices || rawList.result;
                    // Filtrage : On ne garde que la catégorie 'fs' (Fans) ou les noms contenant 'ventilo'
                    const fansOnly = allDevices.filter(d => 
                        d.category === 'fsd' || 
                        d.name.toLowerCase().includes('ventilo') ||
                        d.name.toLowerCase().includes('ventilateur')
                    );
                    response = { ...rawList, result: fansOnly };
                } else {
                    response = rawList;
                }
                break;

            case 'getSchema':
                // Récupère les fonctions supportées (ex: savoir s'il y a une lumière)
                response = await tuya.request({
                    path: `/v1.0/devices/${deviceId}/specifications`,
                    method: 'GET'
                });
                break;

            case 'getStatus':
                // Récupère l'état actuel des fonctions (Vitesse, ON/OFF, Lumière)
                response = await tuya.request({
                    path: `/v1.0/devices/${deviceId}/status`,
                    method: 'GET'
                });
                break;

            case 'send':
                // Envoie une commande spécifique à l'appareil
                response = await tuya.request({
                    path: `/v1.0/devices/${deviceId}/commands`,
                    method: 'POST',
                    body: { 
                        "commands": [
                            { "code": code, "value": value }
                        ] 
                    }
                });
                break;

            default:
                return res.status(400).json({ success: false, msg: "Action non reconnue" });
        }

        // Renvoi de la réponse de Tuya au navigateur
        return res.status(200).json(response);

    } catch (error) {
        console.error("Erreur API Tuya:", error.message);
        return res.status(500).json({ 
            success: false, 
            msg: "Erreur serveur", 
            error: error.message 
        });
    }
}
