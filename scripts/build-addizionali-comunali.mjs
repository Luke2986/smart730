#!/usr/bin/env node
/**
 * Genera src/data/addizionali/comunali.json dagli elenchi MEF dell'addizionale comunale IRPEF.
 *
 * Fonte: https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/download/tabella.htm
 * Uso:   node scripts/build-addizionali-comunali.mjs <Add_comunale_irpefANNO.csv>   (ANNO = anno d'imposta)
 *
 * La stessa regola vale per il saldo e per l'acconto dell'anno successivo: l'acconto si calcola sempre con
 * l'aliquota deliberata per l'anno d'imposta (art. 8, c. 2, D.Lgs. 175/2014), applicata dal comune del domicilio
 * al 1° gennaio dell'anno successivo.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [csvPath] = process.argv.slice(2);
if (!csvPath) {
  console.error('Uso: node scripts/build-addizionali-comunali.mjs <csv anno d\'imposta>');
  process.exit(1);
}

const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/addizionali/comunali.json');

function readCsv(path) {
  const [header, ...lines] = readFileSync(path, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const columns = header.split(';').map((c) => c.trim());
  return lines.map((line) => {
    const values = line.split(';');
    return Object.fromEntries(columns.map((c, i) => [c, (values[i] ?? '').trim()]));
  });
}

function yearOf(path, rows) {
  const fromName = basename(path).match(/(20\d\d)/);
  if (fromName) return Number(fromName[1]);
  throw new Error(`Anno non ricavabile dal nome file: ${path} (${rows.length} righe)`);
}

/** "15.000,01" | "28000.00" | "28.000" | "28.000,000" → numero */
function parseNumber(token) {
  const t = token.replace(/[€\s]/g, '');
  const last = Math.max(t.lastIndexOf('.'), t.lastIndexOf(','));
  if (last === -1) return Number(t);
  const decimals = t.slice(last + 1);
  const mixed = t.includes('.') && t.includes(',');
  if (mixed || decimals.length !== 3) {
    return Number(`${t.slice(0, last).replace(/[.,]/g, '') || '0'}.${decimals}`);
  }
  return Number(t.replace(/[.,]/g, ''));
}

function parseRate(value) {
  if (!value || value.startsWith('0*')) return 0;
  return Number(value.replace(',', '.'));
}

function numbersIn(text) {
  return (text.match(/\d[\d.,]*\d|\d/g) ?? []).map(parseNumber).filter((n) => Number.isFinite(n));
}

/** Limite superiore dello scaglione, null se aperto ("oltre 50.000", "da 50.000,01"). */
function upperBound(text) {
  const numbers = numbersIn(text);
  if (numbers.length === 0) return undefined;
  const lower = text.toLowerCase();
  const aperto = /\b(oltre|olre|superiori?|eccedenti?)\b/.test(lower) || /(^|\s)da\s/.test(lower.replace(/^applicabile a\s+/, ''));
  if (numbers.length === 1 && aperto) {
    return null;
  }
  return Math.round(Math.max(...numbers));
}

const ESENZIONE_IMPONIBILE = /^esenzione per redditi imponibili fino a/i;

function buildRule(row) {
  const rule = {};
  const bands = [];
  const special = [];
  let single;

  for (let i = 1; i <= 12; i++) {
    const suffix = i === 1 ? '' : `_${i}`;
    const rate = row[`ALIQUOTA${suffix}`];
    const fascia = row[`FASCIA${suffix}`].replace(/\s+/g, ' ');
    if (!rate && !fascia) continue;

    if (ESENZIONE_IMPONIBILE.test(fascia)) {
      rule.e = numbersIn(fascia)[0];
    } else if (/^esenzione/i.test(fascia)) {
      special.push(fascia);
    } else if (/aliquota unica/i.test(fascia) || !fascia) {
      single = parseRate(rate);
    } else {
      bands.push([upperBound(fascia), parseRate(rate), fascia]);
    }
  }

  const importoEsente = Number(row.IMPORTO_ESENTE || 0);
  if (importoEsente > 0) rule.e = importoEsente;
  if (!rule.e) delete rule.e;

  if (bands.length > 0) {
    rule.s = bands.map(([upper, rate]) => [upper ?? null, rate]);
    const uppers = bands.map(([upper]) => upper);
    const valid = uppers.every((u, idx) =>
      idx === uppers.length - 1 ? u === null : typeof u === 'number' && (idx === 0 || u > uppers[idx - 1])
    );
    if (!valid || single !== undefined) {
      rule.v = 'Scaglioni non standard: verifica la delibera del comune.';
      console.warn(`[verifica] ${row.CODICE_CATASTALE} ${row.COMUNE}: ${bands.map((b) => `${b[1]}% ${b[2]}`).join(' | ')}`);
    }
  } else {
    rule.a = single ?? 0;
  }

  if (special.length > 0) rule.x = special;
  if (/INAPPLICABILE/i.test(row.NOTE)) rule.v = row.NOTE;
  return rule;
}

const rows = readCsv(csvPath);
const anno = yearOf(csvPath, rows);

const rules = [];
const ruleIndex = new Map();
const indexOf = (rule) => {
  const key = JSON.stringify(rule);
  if (!ruleIndex.has(key)) {
    ruleIndex.set(key, rules.length);
    rules.push(rule);
  }
  return ruleIndex.get(key);
};

const comuni = {};
for (const row of rows) {
  comuni[row.CODICE_CATASTALE] = [row.COMUNE, row.PR, indexOf(buildRule(row))];
}

const output = {
  fonte: 'MEF - Dipartimento delle Finanze, elenco addizionale comunale IRPEF',
  anno,
  generato: new Date().toISOString().slice(0, 10),
  regole: rules,
  comuni
};

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(output));
console.log(`${Object.keys(comuni).length} comuni, ${rules.length} regole distinte (anno ${anno}) → ${OUTPUT}`);
