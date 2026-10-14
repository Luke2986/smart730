import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { CUData, DetrazioneAffittoData, DetrazioneMutuoData, DomicilioFiscale, Smart730State, Spesa } from '@/types/tax';
import { calculateAggregatedCU, conDomicilio } from '@/utils/cuAggregation';
import { calculateCompleteTaxResult, type TaxCalculationResult } from '@/utils/taxCalculations';

// I dati vivono solo in memoria: chiudendo o ricaricando la pagina spariscono.
const initialState: Smart730State = {
  cus: [],
  selectedCuId: null,
  giorniLavoro: null,
  spese: {},
  affitto: null,
  mutuo: null
};

type Action =
  | { type: 'ADD_CU'; payload: CUData }
  | { type: 'UPDATE_CU'; payload: CUData }
  | { type: 'REMOVE_CU'; payload: string }
  | { type: 'SELECT_CU'; payload: string | null }
  | { type: 'SET_GIORNI_LAVORO'; payload: number | null }
  | { type: 'ADD_SPESE'; payload: Spesa[] }
  | { type: 'REMOVE_SPESA'; payload: string }
  | { type: 'SET_AFFITTO'; payload: DetrazioneAffittoData | null }
  | { type: 'SET_MUTUO'; payload: DetrazioneMutuoData | null }
  | { type: 'SET_DOMICILIO'; payload: { domicilio: DomicilioFiscale; domicilioAcconto: DomicilioFiscale | null } }
  | { type: 'RESET' };

function reducer(state: Smart730State, action: Action): Smart730State {
  switch (action.type) {
    case 'ADD_CU':
      return { ...state, cus: [...state.cus, action.payload], selectedCuId: action.payload.id };

    case 'UPDATE_CU':
      return {
        ...state,
        cus: state.cus.map((cu) => (cu.id === action.payload.id ? action.payload : cu)),
        selectedCuId: action.payload.id
      };

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

    case 'RESET':
      return initialState;
  }
}

const haDati = (state: Smart730State) =>
  state.cus.length > 0 || Object.keys(state.spese).length > 0 || state.affitto !== null || state.mutuo !== null;

interface Smart730ContextValue {
  state: Smart730State;
  /** Somma delle CU usata dal calcolo. */
  aggregatedCu: CUData | null;
  /** CU mostrata nel dettaglio: quella scelta, altrimenti l'unica o il totale. */
  cuSelezionata: CUData | null;
  taxResult: TaxCalculationResult;
  addCU: (cu: CUData) => void;
  aggiornaCU: (cu: CUData) => void;
  removeCU: (id: string) => void;
  selectCU: (id: string | null) => void;
  setGiorniLavoro: (giorni: number | null) => void;
  addSpese: (spese: Spesa[]) => void;
  removeSpesa: (id: string) => void;
  setAffitto: (affitto: DetrazioneAffittoData | null) => void;
  setMutuo: (mutuo: DetrazioneMutuoData | null) => void;
  setDomicilio: (domicilio: DomicilioFiscale, domicilioAcconto: DomicilioFiscale | null) => void;
  cancellaTutto: () => void;
}

const Smart730Context = createContext<Smart730ContextValue | undefined>(undefined);

export function Smart730Provider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

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

  // Avvisa prima di chiudere o ricaricare la pagina: i dati non sono salvati da nessuna parte.
  const conDati = haDati(state);
  useEffect(() => {
    if (!conDati) return;
    const avvisa = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', avvisa);
    return () => window.removeEventListener('beforeunload', avvisa);
  }, [conDati]);

  const azioni = useMemo(() => ({
    addCU: (cu: CUData) => dispatch({ type: 'ADD_CU', payload: cu }),
    aggiornaCU: (cu: CUData) => dispatch({ type: 'UPDATE_CU', payload: cu }),
    removeCU: (id: string) => dispatch({ type: 'REMOVE_CU', payload: id }),
    selectCU: (id: string | null) => dispatch({ type: 'SELECT_CU', payload: id }),
    setGiorniLavoro: (giorni: number | null) => dispatch({ type: 'SET_GIORNI_LAVORO', payload: giorni }),
    addSpese: (spese: Spesa[]) => dispatch({ type: 'ADD_SPESE', payload: spese }),
    removeSpesa: (id: string) => dispatch({ type: 'REMOVE_SPESA', payload: id }),
    setAffitto: (affitto: DetrazioneAffittoData | null) => dispatch({ type: 'SET_AFFITTO', payload: affitto }),
    setMutuo: (mutuo: DetrazioneMutuoData | null) => dispatch({ type: 'SET_MUTUO', payload: mutuo }),
    setDomicilio: (domicilio: DomicilioFiscale, domicilioAcconto: DomicilioFiscale | null) =>
      dispatch({ type: 'SET_DOMICILIO', payload: { domicilio, domicilioAcconto } }),
    cancellaTutto: () => dispatch({ type: 'RESET' })
  }), []);

  const value = useMemo<Smart730ContextValue>(
    () => ({ state, aggregatedCu, cuSelezionata, taxResult, ...azioni }),
    [state, aggregatedCu, cuSelezionata, taxResult, azioni]
  );

  return <Smart730Context.Provider value={value}>{children}</Smart730Context.Provider>;
}

export function useTaxState() {
  const context = useContext(Smart730Context);
  if (context === undefined) {
    throw new Error('useTaxState must be used within a Smart730Provider');
  }
  return context;
}
