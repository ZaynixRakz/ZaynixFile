const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const LICENSE_FILE = path.join(DATA_DIR, "licenses.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(LICENSE_FILE)) {
    fs.writeFileSync(LICENSE_FILE, JSON.stringify([], null, 2));
}

function loadLicenses() {
    return JSON.parse(fs.readFileSync(LICENSE_FILE, "utf8"));
}

function saveLicenses(data) {
    fs.writeFileSync(
        LICENSE_FILE,
        JSON.stringify(data, null, 2)
    );
}

function generateKey() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    function block() {
        let result = "";

        for (let i = 0; i < 4; i++) {
            result += chars[
                crypto.randomInt(0, chars.length)
            ];
        }

        return result;
    }

    return `ZYNX-${block()}-${block()}-${block()}`;
}

function calculateExpiry(duration) {
    if (duration === "lifetime") {
        return null;
    }

    const days = {
        "1d": 1,
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "1y": 365
    };

    if (!days[duration]) {
        return null;
    }

    const date = new Date();

    date.setDate(
        date.getDate() + days[duration]
    );

    return date.toISOString();
}

/*
---------------------------------------
HEALTH CHECK
---------------------------------------
*/

app.get("/", (req, res) => {
    res.json({
        app: "Zaynix File",
        status: "online",
        version: "1.0.0"
    });
});

/*
---------------------------------------
GENERATE LICENSE
---------------------------------------
*/

app.post("/admin/generate", (req, res) => {

    const {
        duration = "lifetime",
        quantity = 1
    } = req.body;

    const licenses = loadLicenses();

    const created = [];

    for (let i = 0; i < quantity; i++) {

        const key = generateKey();

        const license = {
            key,
            duration,
            created_at: new Date().toISOString(),
            expires_at: calculateExpiry(duration),
            activated: false,
            device_id: null,
            revoked: false
        };

        licenses.push(license);
        created.push(license);
    }

    saveLicenses(licenses);

    res.json({
        success: true,
        licenses: created
    });
});

/*
---------------------------------------
ACTIVATE LICENSE
---------------------------------------
*/

app.post("/activate", (req, res) => {

    const {
        key,
        device_id
    } = req.body;

    if (!key || !device_id) {
        return res.status(400).json({
            success: false,
            message: "Key dan device_id wajib diisi."
        });
    }

    const licenses = loadLicenses();

    const license = licenses.find(
        x => x.key === key
    );

    if (!license) {
        return res.status(404).json({
            success: false,
            message: "License tidak ditemukan."
        });
    }

    if (license.revoked) {
        return res.status(403).json({
            success: false,
            message: "License sudah dicabut."
        });
    }

    if (
        license.expires_at &&
        new Date(license.expires_at) < new Date()
    ) {
        return res.status(403).json({
            success: false,
            message: "License sudah expired."
        });
    }

    if (
        license.device_id &&
        license.device_id !== device_id
    ) {
        return res.status(403).json({
            success: false,
            message: "License sudah terikat ke device lain."
        });
    }

    license.device_id = device_id;
    license.activated = true;

    saveLicenses(licenses);

    res.json({
        success: true,
        message: "License berhasil diaktifkan.",
        expires_at: license.expires_at
    });
});

app.listen(PORT, () => {
    console.log(
        `Zaynix File API berjalan di port ${PORT}`
    );
});