# 🧪 Quick Test Guide - Barra Filtri

## Test Rapido (5 minuti)

### 1️⃣ Test Debounce Ricerca
```
✓ Apri una lista con requisiti
✓ Digita velocemente nella barra ricerca: "test"
✓ Verifica che l'input sia reattivo (nessun lag)
✓ Attendi 300ms
✓ Verifica che i risultati si filtrino
```
**Atteso**: Input fluido, filtro dopo breve pausa

---

### 2️⃣ Test Type Safety
```
✓ Click su filtro "Priorità"
✓ Seleziona "Alta"
✓ Verifica chip comparso sotto
✓ Apri console browser (F12)
✓ Verifica nessun errore rosso
```
**Atteso**: Nessun errore in console

---

### 3️⃣ Test Reset Filtri
```
✓ Digita nella ricerca: "esempio"
✓ Seleziona Priorità = Alta
✓ Seleziona Stato = Proposto
✓ Click "Reimposta filtri"
✓ Verifica che:
  - Input ricerca si svuoti
  - Tutti i chips spariscano
  - Tutti i requisiti tornino visibili
```
**Atteso**: Reset completo di tutto

---

### 4️⃣ Test Performance
```
✓ Naviga a lista con 20+ requisiti
✓ Digita molto velocemente: "aaaaabbbbbccccc"
✓ Cancella tutto rapidamente
✓ Applica/rimuovi filtri velocemente 5 volte
✓ Verifica nessun lag o freeze
```
**Atteso**: Tutto fluido e reattivo

---

## 🐛 Cosa Verificare (Regression Test)

| Scenario | Comportamento Atteso |
|----------|---------------------|
| Lista vuota | Nessun errore, mostra empty state |
| Ricerca senza match | Mostra "Nessun requisito trovato" |
| Filtri multipli | AND logic applicata correttamente |
| Cambio rapido filtri | Nessun race condition |
| Reset durante typing | Input si svuota immediatamente |

---

## ✅ Checklist Veloce

- [ ] Input ricerca reattivo (no lag)
- [ ] Filtro applicato dopo ~300ms
- [ ] Chips corretti per ogni filtro
- [ ] Reset pulisce tutto
- [ ] Nessun errore in console
- [ ] Performance OK con molti dati
- [ ] Conteggio "X filtri attivi" corretto

---

## 🔍 Debug

Se qualcosa non funziona:

1. **Apri React DevTools**
   - Trova componente `RequirementsList`
   - Ispeziona state:
     - `searchInput` (immediato)
     - `filters.search` (ritardato)
     - `debouncedSearch` (300ms delay)

2. **Console Browser**
   - Cerca errori rossi
   - Cerca warning gialli
   - Verifica nessun infinite loop

3. **Network Tab**
   - Verifica nessuna chiamata duplicata
   - Debounce dovrebbe ridurre chiamate

---

## 🎯 Criteri Successo

✅ **PASS** se:
- Input sempre reattivo
- Filtri funzionano correttamente
- Reset completo
- Zero errori console
- Performance fluida

❌ **FAIL** se:
- Lag durante digitazione
- Filtri non applicati
- Reset parziale
- Errori in console
- Freeze o crash

---

*Quick test dovrebbe richiedere ~5 minuti*  
*Per test completo vedi FILTER_BAR_MANUAL_TESTS.js*
