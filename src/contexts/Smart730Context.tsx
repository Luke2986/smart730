import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type { CUData, DetrazioneAffittoData, DetrazioneMutuoData, DomicilioFiscale, Smart730State, Spesa } from '@/types/tax';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { calculateAggregatedCU, conDomicilio } from '@/utils/cuAggregation';
import { calculateCompleteTaxResult, type TaxCalculationResult } from '@/utils/taxCalculations';
import { ANNO_IMPOSTA } from '@/utils/annoFiscale';
import { DATI_VUOTI, daRiga, datiDaStato, impronta, isVuoto, versoRiga, type DatiDichiarazione } from '@/utils/persistenza';

const TABELLA = 'tax_declarations';
const BUCKET_CU = 'cu-documents';
const RITARDO_SALVATAGGIO_MS = 1000;

const initialState: Smart730State = { ...DATI_VUOTI, selectedCuId: null };

type Action =
  | { type: 'ADD_CU'; payload: CUData }
  | { type: 'REMOVE_CU'; payload: string }
  | { type: 'SELECT_CU'; payload: string | null }
  | { type: 'SET_GIORNI_LAVORO'; payload: number | null }
  | { type: 'ADD_SPESE'; payload: Spesa[] }
  | { type: 'REMOVE_SPESA'; payload: string }
  | { type: 'SET_AFFITTO'; payload: DetrazioneAffittoData | null }
  | { type: 'SET_MUTUO'; payload: DetrazioneMutuoData | null }
  | { type: 'SET_DOMICILIO'; payload: { domicilio: DomicilioFiscale; domicilioAcconto: DomicilioFiscale | null } }
  | { type: 'LOAD'; payload: DatiDichiarazione }
  | { type: 'RESET' };

function reducer(state: Smart730State, action: Action): Smart730State {
  switch (action.type) {
    case 'ADD_CU':
      return { ...state, cus: [...state.cus, action.payload], selectedCuId: action.payload.id };

    case 'REMOVE_CU': {
      const cus = state.cus.filter((cu) => cu.id !== action.payload);
      const selectedCuId = state.selectedCuId === action.payload || cus.length < 2 ? null : state.selectedCuId;
      return { ...state, cus, selectedCuId, giorniLavoro: cus.length < 2 ? null : state.giorniLavoro };
    }

    case 'SELECT_CU':
      return { ...state, selectedCuId: action.payload };

    case 'SET_GIORNI_LAVORO':
      return { ...state, giorniLavoro: action.payload };

    case 'ADD_SPESE':
      return {
        ...state,
        spese: { ...state.spese, ...Object.fromEntries(action.payload.map((spesa) => [spesa.id, spesa])) }
      };

    case 'REMOVE_SPESA': {
      const { [action.payload]: _rimossa, ...spese } = state.spese;
      return { ...state, spese };
    }

    case 'SET_AFFITTO':
      return { ...state, affitto: action.payload };

    case 'SET_MUTUO':
      return { ...state, mutuo: action.payload };

    case 'SET_DOMICILIO': {
      const { domicilio, domicilioAcconto } = action.payload;
      return { ...state, cus: state.cus.map((cu) => conDomicilio(cu, domicilio, domicilioAcconto)) };
    }

    case 'LOAD':
      return { ...action.payload, selectedCuId: null };

    case 'RESET':
      return initialState;
  }
}

/** locale: nessun utente, i dati restano solo in questa pagina. */
export type StatoSalvataggio =
  | 'locale'
  | 'caricamento'
  | 'salvataggio'
  | 'salvato'
  | 'errore-caricamento'
  | 'errore-salvataggio';

interface Smart730ContextValue {
  state: Smart730State;
  /** Somma delle CU usata dal calcolo. */
  aggregatedCu: CUData | null;
  /** CU mostrata nel dettaglio: quella scelta, altrimenti l'unica o il totale. */
  cuSelezionata: CUData | null;
  taxResult: TaxCalculationResult;
  salvataggio: { stato: StatoSalvataggio; riprova: () => void };
  addCU: (cu: CUData) => void;
  removeCU: (id: string) => void;
  selectCU: (id: string | null) => void;
  setGiorniLavoro: (giorni: number | null) => void;
  addSpese: (spese: Spesa[]) => void;
  removeSpesa: (id: string) => void;
  setAffitto: (affitto: DetrazioneAffittoData | null) => void;
  setMutuo: (mutuo: DetrazioneMutuoData | null) => void;
  setDomicilio: (domicilio: DomicilioFiscale, domicilioAcconto: DomicilioFiscale | null) => void;
  /** Cancella le dichiarazioni salvate e i file dell'utente, poi svuota lo stato. */
  eliminaDati: () => Promise<void>;
}

const Smart730Context = createContext<Smart730ContextValue | undefined>(undefined);

export function Smart730Provider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [stato, setStato] = useState<StatoSalvataggio>('locale');
  const [caricatoPer, setCaricatoPer] = useState<string | null>(null);
  const [tentativoCaricamento, setTentativoCaricamento] = useState(0);
  const [tentativoSalvataggio, setTentativoSalvataggio] = useState(0);
  // Impronta dei dati presenti nel database: null se non c'è una riga salvata.
  const ultimoSalvato = useRef<string | null>(null);
  // Scritture in serie: una scrittura vecchia non può arrivare dopo una più recente.
  const coda = useRef<Promise<void>>(Promise.resolve());
  const utenteCorrente = useRef<string | null>(null);

  const aggregatedCu = useMemo(
    () => calculateAggregatedCU(state.cus, state.giorniLavoro),
    [state.cus, state.giorniLavoro]
  );
  const taxResult = useMemo(
    () => calculateCompleteTaxResult({ cu: aggregatedCu, spese: state.spese, mutuo: state.mutuo, affitto: state.affitto }),
    [aggregatedCu, state.spese, state.mutuo, state.affitto]
  );
  const cuSelezionata = useMemo(() => {
    if (state.selectedCuId && state.selectedCuId !== 'aggregated') {
      const cu = state.cus.find((c) => c.id === state.selectedCuId);
      if (cu) return cu;
    }
    return aggregatedCu;
  }, [state.selectedCuId, state.cus, aggregatedCu]);

  const dati = useMemo(() => datiDaStato(state), [state]);
  const improntaCorrente = useMemo(() => impronta(dati), [dati]);

  useEffect(() => {
    if (authLoading) return;
    const precedente = utenteCorrente.current;
    utenteCorrente.current = userId;
    if (precedente !== null && precedente !== userId) dispatch({ type: 'RESET' });
    ultimoSalvato.current = null;
    setCaricatoPer(null);
    if (!userId) {
      setStato('locale');
      return;
    }

    let annullato = false;
    setStato('caricamento');
    (async () => {
      const { data, error } = await supabase
        .from(TABELLA)
        .select('quadro_c_data, quadro_e_data')
        .eq('user_id', userId)
        .eq('year', ANNO_IMPOSTA)
        .maybeSingle();
      if (error) throw error;
      return data ? daRiga(data) : null;
    })().then(
      (salvati) => {
        if (annullato) return;
        if (salvati && !isVuoto(salvati)) dispatch({ type: 'LOAD', payload: salvati });
        ultimoSalvato.current = salvati ? impronta(salvati) : null;
        setCaricatoPer(userId);
        setStato('salvato');
      },
      () => {
        if (annullato) return;
        setStato('errore-caricamento');
        toast({
          variant: 'destructive',
          title: 'Dati non caricati',
          description: 'Non riesco a leggere la dichiarazione salvata. Le modifiche non vengono salvate finché non riprovi.'
        });
      }
    );
    return () => {
      annullato = true;
    };
  }, [userId, authLoading, tentativoCaricamento]);

  const salva = useCallback((uid: string, daSalvare: DatiDichiarazione, improntaDati: string) => {
    coda.current = coda.current.then(async () => {
      const vuoto = isVuoto(daSalvare);
      if (utenteCorrente.current !== uid || improntaDati === ultimoSalvato.current) return;
      if (vuoto && ultimoSalvato.current === null) return;

      setStato('salvataggio');
      let fallito = false;
      try {
        const { error } = vuoto
          ? await supabase.from(TABELLA).delete().eq('user_id', uid).eq('year', ANNO_IMPOSTA)
          : await supabase
              .from(TABELLA)
              .upsert({ user_id: uid, year: ANNO_IMPOSTA, status: 'draft', ...versoRiga(daSalvare) }, { onConflict: 'user_id,year' });
        fallito = Boolean(error);
      } catch {
        fallito = true;
      }
      if (utenteCorrente.current !== uid) return;
      if (fallito) {
        setStato('errore-salvataggio');
        toast({ variant: 'destructive', title: 'Salvataggio non riuscito', description: 'Le ultime modifiche non sono state salvate.' });
        return;
      }
      ultimoSalvato.current = vuoto ? null : improntaDati;
      setStato('salvato');
    });
  }, []);

  useEffect(() => {
    if (!userId || caricatoPer !== userId) return;
    if (improntaCorrente === ultimoSalvato.current) return;
    if (ultimoSalvato.current === null && isVuoto(dati)) return;
    const timer = setTimeout(() => salva(userId, dati, improntaCorrente), RITARDO_SALVATAGGIO_MS);
    return () => clearTimeout(timer);
  }, [improntaCorrente, dati, userId, caricatoPer, salva, tentativoSalvataggio]);

  const riprova = useCallback(() => {
    if (stato === 'errore-caricamento') setTentativoCaricamento((n) => n + 1);
    if (stato === 'errore-salvataggio') setTentativoSalvataggio((n) => n + 1);
  }, [stato]);

  const eliminaDati = useCallback(() => {
    const uid = utenteCorrente.current;
    dispatch({ type: 'RESET' });
    if (!uid) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      coda.current = coda.current.then(async () => {
        try {
          const { error } = await supabase.from(TABELLA).delete().eq('user_id', uid);
          if (error) throw error;
          // Le CU vengono cancellate dopo la lettura: qui restano solo i file di letture interrotte.
          const { data: files, error: listError } = await supabase.storage.from(BUCKET_CU).list(uid);
          if (listError) throw listError;
          if (files.length > 0) {
            const { error: removeError } = await supabase.storage.from(BUCKET_CU).remove(files.map((f) => `${uid}/${f.name}`));
            if (removeError) throw removeError;
          }
          ultimoSalvato.current = null;
          if (utenteCorrente.current === uid) setStato('salvato');
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }, []);

  const azioni = useMemo(() => ({
    addCU: (cu: CUData) => dispatch({ type: 'ADD_CU', payload: cu }),
    removeCU: (id: string) => dispatch({ type: 'REMOVE_CU', payload: id }),
    selectCU: (id: string | null) => dispatch({ type: 'SELECT_CU', payload: id }),
    setGiorniLavoro: (giorni: number | null) => dispatch({ type: 'SET_GIORNI_LAVORO', payload: giorni }),
    addSpese: (spese: Spesa[]) => dispatch({ type: 'ADD_SPESE', payload: spese }),
    removeSpesa: (id: string) => dispatch({ type: 'REMOVE_SPESA', payload: id }),
    setAffitto: (affitto: DetrazioneAffittoData | null) => dispatch({ type: 'SET_AFFITTO', payload: affitto }),
    setMutuo: (mutuo: DetrazioneMutuoData | null) => dispatch({ type: 'SET_MUTUO', payload: mutuo }),
    setDomicilio: (domicilio: DomicilioFiscale, domicilioAcconto: DomicilioFiscale | null) =>
      dispatch({ type: 'SET_DOMICILIO', payload: { domicilio, domicilioAcconto } })
  }), []);

  const value = useMemo<Smart730ContextValue>(() => ({
    state,
    aggregatedCu,
    cuSelezionata,
    taxResult,
    salvataggio: { stato, riprova },
    ...azioni,
    eliminaDati
  }), [state, aggregatedCu, cuSelezionata, taxResult, stato, riprova, azioni, eliminaDati]);

  return <Smart730Context.Provider value={value}>{children}</Smart730Context.Provider>;
}

export function useTaxState() {
  const context = useContext(Smart730Context);
  if (context === undefined) {
    throw new Error('useTaxState must be used within a Smart730Provider');
  }
  return context;
}
