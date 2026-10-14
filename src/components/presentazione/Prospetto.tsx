import type { ReactNode } from 'react';
import { useTaxState } from '@/contexts/Smart730Context';
import { calcolaDetrazioneSanitarie } from '@/utils/medicalExpenseCalculations';
import { formatCurrencyDetailed } from '@/utils/taxCalculations';
import { controlliDichiarazione } from '@/utils/controlli';
import { DOCUMENTI_DA_CONSERVARE, documentiPerDichiarazione } from '@/utils/documenti';
import { ANNO_DICHIARAZIONE, ANNO_IMPOSTA } from '@/utils/annoFiscale';
import type { DomicilioFiscale, SpesaSanitaria } from '@/types/tax';

const euro = formatCurrencyDetailed;

/** Importi della liquidazione: positivi a debito, negativi a credito. */
const saldo = (importo: number) =>
  importo > 0 ? `a debito ${euro(importo)}` : importo < 0 ? `a credito ${euro(-importo)}` : euro(0);

const comune = (d: DomicilioFiscale | null | undefined) =>
  d && (d.comune || d.codiceComune) ? `${d.comune || d.codiceComune}${d.provincia ? ` (${d.provincia})` : ''}` : 'non indicato';

const TIPO_AFFITTO = { libero: 'canone libero', concordato: 'canone concordato', giovani_under31: 'giovani under 31' };

/** Prospetto stampabile: stessi numeri della schermata Riepilogo, impaginati come un documento. */
export function Prospetto() {
  const { state, aggregatedCu, taxResult: r } = useTaxState();
  if (!aggregatedCu) return null;

  const sanitarie = calcolaDetrazioneSanitarie(
    Object.values(state.spese).filter((s): s is SpesaSanitaria => s.tipo === 'sanitarie')
  );
  const tutti = controlliDichiarazione(state, r);
  const controlli = tutti.filter((c) => c.livello !== 'nota');
  const note = tutti.filter((c) => c.livello === 'nota');
  const { datiAnagrafici, detrazioni, ritenute, acconti } = aggregatedCu.backend;
  const piuCU = state.cus.length > 1;

  return (
    <article className="rounded-lg bg-white p-5 text-[13px] leading-relaxed text-neutral-900 shadow-lg sm:p-8 print:rounded-none print:p-0 print:shadow-none">
      <header className="border-b border-neutral-300 pb-4">
        <div className="text-xs uppercase tracking-wide text-neutral-500">Smart730 · stima indicativa</div>
        <h2 className="mt-1 text-xl font-bold">
          Prospetto di calcolo 730/{ANNO_DICHIARAZIONE} (redditi {ANNO_IMPOSTA})
        </h2>
        <p className="mt-1 text-xs text-neutral-600">
          Generato il {new Date().toLocaleDateString('it-IT')}. Non è il modello 730-3 ufficiale e non è stato inviato
          all'Agenzia delle Entrate: confrontalo con la precompilata o portalo al CAF.
        </p>
      </header>

      <Sezione titolo="Redditi (quadro C)">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="border-b border-neutral-300 text-left text-xs text-neutral-500">
                <th className="py-1 pr-2 font-medium">CU</th>
                <Th>Lavoro dip.</Th>
                <Th>Pensione</Th>
                <Th>Altri</Th>
                <Th>Giorni</Th>
                <Th>IRPEF trattenuta</Th>
                <Th>Add. regionale</Th>
                <Th>Add. comunale</Th>
              </tr>
            </thead>
            <tbody>
              {state.cus.map((cu, i) => (
                <tr key={cu.id} className="border-b border-neutral-200">
                  <td className="py-1 pr-2">CU {i + 1}</td>
                  <Td>{euro(cu.backend.redditi.lavoroDipendente)}</Td>
                  <Td>{euro(cu.backend.redditi.pensione)}</Td>
                  <Td>{euro(cu.backend.redditi.assimilati)}</Td>
                  <Td>{cu.backend.redditi.lavoroDipendente > 0 ? cu.backend.detrazioni.giorniLavorati : '–'}</Td>
                  <Td>{euro(cu.backend.ritenute.irpef)}</Td>
                  <Td>{euro(cu.backend.ritenute.addRegionale)}</Td>
                  <Td>{euro(cu.backend.ritenute.addComunale)}</Td>
                </tr>
              ))}
              {piuCU && (
                <tr className="font-semibold">
                  <td className="py-1 pr-2">Totale</td>
                  <Td>{euro(aggregatedCu.backend.redditi.lavoroDipendente)}</Td>
                  <Td>{euro(aggregatedCu.backend.redditi.pensione)}</Td>
                  <Td>{euro(aggregatedCu.backend.redditi.assimilati)}</Td>
                  <Td>{detrazioni.giorniLavorati}</Td>
                  <Td>{euro(ritenute.irpef)}</Td>
                  <Td>{euro(ritenute.addRegionale)}</Td>
                  <Td>{euro(ritenute.addComunale)}</Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Righe>
          {piuCU && (
            <Riga
              voce="Giorni di lavoro usati nel calcolo (rigo C5)"
              valore={`${detrazioni.giorniLavorati}${state.giorniLavoro === null ? ' (somma delle CU)' : ' (indicati da te)'}`}
            />
          )}
          {r.sommaEsente && (
            <Riga
              voce="Somma esente per redditi fino a 20.000 €: spettante / ricevuta in busta paga"
              valore={`${euro(r.sommaEsente.spettante)} / ${euro(r.sommaEsente.erogata)}`}
            />
          )}
          {acconti.totaleAcconti > 0 && <Riga voce={`Acconti IRPEF ${ANNO_IMPOSTA} già versati`} valore={euro(acconti.totaleAcconti)} />}
          <Riga voce={`Domicilio fiscale all'1/1/${ANNO_IMPOSTA}`} valore={comune(datiAnagrafici.domicilioFiscale)} />
          {datiAnagrafici.domicilioFiscaleAcconto && (
            <Riga voce={`Domicilio fiscale all'1/1/${ANNO_DICHIARAZIONE}`} valore={comune(datiAnagrafici.domicilioFiscaleAcconto)} />
          )}
        </Righe>
      </Sezione>

      <Sezione titolo="Oneri detraibili (quadro E)">
        {sanitarie.speseMediche === 0 && sanitarie.speseVeterinarie === 0 && !state.mutuo && !state.affitto ? (
          <p className="text-neutral-600">Nessuna spesa inserita.</p>
        ) : (
          <Righe>
            {sanitarie.speseMediche > 0 && (
              <Riga
                voce={`Rigo E1 · spese sanitarie ${euro(sanitarie.speseMediche)}`}
                valore={`detrazione ${euro(sanitarie.detrazioneMediche)}`}
              />
            )}
            {sanitarie.speseVeterinarie > 0 && (
              <Riga
                voce={`Righi E8-E10 codice 29 · spese veterinarie ${euro(sanitarie.speseVeterinarie)}`}
                valore={`detrazione ${euro(sanitarie.detrazioneVeterinarie)}`}
              />
            )}
            {state.mutuo && (
              <Riga
                voce={`Rigo E7 · interessi mutuo ${euro(state.mutuo.interessiPagati)}, quota ${state.mutuo.percentualeIntestazione}%`}
                valore={`detrazione ${euro(r.detrazioniOneri.mutuo)}`}
              />
            )}
            {state.affitto && (
              <Riga
                voce={`Rigo E71 · affitto (${TIPO_AFFITTO[state.affitto.tipoContratto]}), ${state.affitto.giorniAffitto} giorni, ${state.affitto.percentuale}%`}
                valore={`detrazione ${euro(r.detrazioniOneri.affitto)}`}
              />
            )}
            {r.detrazioniOneri.riduzione > 0 && (
              <Riga voce="Riduzione per reddito oltre 120.000 €" valore={`-${euro(r.detrazioniOneri.riduzione)}`} />
            )}
          </Righe>
        )}
      </Sezione>

      <Sezione titolo="Liquidazione (stima)">
        <Righe>
          <Riga voce="Reddito complessivo" valore={euro(r.breakdown.reddito)} />
          <Riga voce="Imposta lorda" valore={euro(r.irpefLorda)} />
          <Riga voce="Detrazioni per lavoro, pensione e altri redditi" valore={euro(r.detrazioneLavoro)} />
          {r.ulterioreDetrazione > 0 && <Riga voce="Ulteriore detrazione (cuneo fiscale)" valore={euro(r.ulterioreDetrazione)} />}
          <Riga voce="Detrazioni per oneri" valore={euro(r.detrazioniSpese)} />
          <Riga voce="Imposta netta" valore={euro(r.irpefNetta)} forte />
          <Riga voce="IRPEF trattenuta dai sostituti" valore={euro(ritenute.irpef)} />
          {r.accreditiPrecedenti > 0 && <Riga voce="Acconti versati e crediti" valore={euro(r.accreditiPrecedenti)} />}
          {r.liquidazione.sommaEsente !== 0 && <Riga voce="Conguaglio della somma esente" valore={saldo(r.liquidazione.sommaEsente)} />}
          <Riga voce={`Saldo IRPEF ${ANNO_IMPOSTA}`} valore={saldo(r.liquidazione.saldoIRPEF)} forte />
          <Riga
            voce={`Addizionale regionale: dovuta ${euro(r.addRegionaleDovuta)}, trattenuta ${euro(ritenute.addRegionale)}`}
            valore={saldo(r.liquidazione.saldoAddRegionale)}
          />
          <Riga
            voce={`Addizionale comunale: dovuta ${euro(r.addComunaleDovuta)}, trattenuta ${euro(ritenute.addComunale)}`}
            valore={saldo(r.liquidazione.saldoAddComunale)}
          />
          <Riga voce={`Acconto addizionale comunale ${ANNO_DICHIARAZIONE}`} valore={saldo(r.liquidazione.accontoAddComunale)} />
          <Riga
            voce={`Acconto IRPEF ${ANNO_DICHIARAZIONE}${r.accontoIRPEF.totale > 0
              ? ` (prima rata ${euro(r.accontoIRPEF.primaRata)}, seconda ${euro(r.accontoIRPEF.secondaRata)})`
              : ''}`}
            valore={saldo(r.liquidazione.accontoIRPEF)}
          />
          <Riga
            voce={r.risultatoFinale >= 0 ? 'Totale a credito' : 'Totale da versare'}
            valore={euro(Math.abs(r.risultatoFinale))}
            forte
          />
        </Righe>
        <p className="mt-2 text-xs text-neutral-600">
          Importi fino a 12 € per singola imposta non si versano e non si rimborsano.
        </p>
      </Sezione>

      {(controlli.length > 0 || note.length > 0) && (
        <Sezione titolo="Avvisi e note sul calcolo">
          <ul className="list-disc space-y-1 pl-5">
            {controlli.map((c, i) => <li key={`c${i}`}>{c.testo}</li>)}
            {note.map((c, i) => <li key={`n${i}`} className="text-neutral-600">{c.testo}</li>)}
          </ul>
        </Sezione>
      )}

      <Sezione titolo="Documenti da conservare">
        <ul className="list-disc space-y-1 pl-5">
          {documentiPerDichiarazione(state).flatMap((tipo) =>
            DOCUMENTI_DA_CONSERVARE[tipo].voci.map((voce) => <li key={`${tipo}-${voce}`}>{voce}</li>)
          )}
        </ul>
      </Sezione>
    </article>
  );
}

function Sezione({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-700">{titolo}</h3>
      {children}
    </section>
  );
}

function Righe({ children }: { children: ReactNode }) {
  return <dl className="mt-2 divide-y divide-neutral-200">{children}</dl>;
}

function Riga({ voce, valore, forte = false }: { voce: string; valore: ReactNode; forte?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1 ${forte ? 'font-semibold' : ''}`}>
      <dt>{voce}</dt>
      <dd className="shrink-0 text-right tabular-nums">{valore}</dd>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="py-1 pl-2 text-right font-medium">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="py-1 pl-2 text-right tabular-nums">{children}</td>;
}
