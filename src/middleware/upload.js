"use strict";

const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ── Aprovação de proposta (imagem do comprovante de aprovação) ────────────────
const approvalDir = path.resolve(__dirname, "../../output/approvals");
fs.mkdirSync(approvalDir, { recursive: true });

const approvalStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, approvalDir),
  filename: (req, _file, cb) => {
    const ext = path.extname(_file.originalname).toLowerCase() || ".jpg";
    cb(null, `approval_${req.params.id}_${Date.now()}${ext}`);
  },
});

const uploadApproval = multer({
  storage: approvalStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ── Notas recebidas (PDF + XML) ───────────────────────────────────────────────
const notasDir = path.resolve(__dirname, "../../output/notas-recebidas");
fs.mkdirSync(notasDir, { recursive: true });

const notasStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, notasDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".bin";
    cb(null, `nota_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const uploadNota = multer({
  storage: notasStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "text/xml", "application/xml"];
    const extOk   = [".pdf", ".xml"].includes(path.extname(file.originalname).toLowerCase());
    cb(null, allowed.includes(file.mimetype) || extOk);
  },
});

// ── Comprovantes de pagamento (baixa de conta a pagar) ────────────────────────
const comprovantesDir = path.resolve(__dirname, "../../output/comprovantes");
fs.mkdirSync(comprovantesDir, { recursive: true });

const comprovantesStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, comprovantesDir),
  filename: (req, _file, cb) => {
    const ext = path.extname(_file.originalname).toLowerCase() || ".jpg";
    cb(null, `comprovante_${req.params.id}_${Date.now()}${ext}`);
  },
});

const uploadComprovante = multer({
  storage: comprovantesStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    const extOk   = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"].includes(
      path.extname(file.originalname).toLowerCase()
    );
    cb(null, allowed.includes(file.mimetype) || extOk);
  },
});

module.exports = { uploadApproval, uploadNota, uploadComprovante };
