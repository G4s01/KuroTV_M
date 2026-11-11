# 🎨 Temi, Design System & Linee Guida Stilistiche

Kuro Mobile è progettato attorno alla filosofia del **Nero Assoluto OLED (`#000000`)** e su standard visivi coerenti con l'identità dell'ecosistema Kuro.

---

## 🖤 Filosofia OLED Puro (`#000000`)

Sui display moderni OLED, AMOLED e Super AMOLED, i pixel neri (`#000000`) sono fisicamente spenti:
1. **Risparmio Energetico**: Riduzione drastica del consumo di batteria durante la navigazione nei cataloghi e la riproduzione video.
2. **Contrasto Infinito**: I colori primari brillanti risaltano con nitidezza assoluta.
3. **Divieto di Grigi Scuri come Background Base**: Lo sfondo principale dell'app (`colors.background`) deve essere sempre rigorosamente `#000000`. I toni grigi (`#171717`, `#262626`) sono riservati esclusivamente a card, separatori e superfici sopraelevate.

---

## 🌈 Palette dei Temi Disponibili

Tutti i temi mantengono il background nero OLED puro, variando il colore primario d'accento:

| Tema | ID | Colore Primario | Icona SVG | Note di Design |
|---|---|---|---|---|
| **OLED Puro** | `oled` | `#E50914` (Rosso Vivo) | `theme-oled.svg` | Tema predefinito iconico |
| **Pikachu** | `pikachu` | `#FAD61D` (Giallo Elettrico) | `theme-pikachu.svg` | Ispirato all'estetica Pokémon |
| **Orchidea** | `orchid` | `#E941FB` (Magenta Fluido) | `theme-orchid.svg` | Toni cyberpunk / neon |
| **Rainbow** | `rainbow` | `#73FEC8` (Turchese Menta) | `theme-rainbow.svg` | Tinta pastello ad alto contrasto |
| **Personalizzato** | `custom` | Configurabile | `theme-custom.svg` | Scelto dall'utente |

Le icone SVG ufficiali risiedono in [`assets/icons/`](file:///home/g4s/VSCode/KuroM/assets/icons/) e vengono renderizzate ad alta risoluzione tramite `expo-image`.

---

## 👆 Regola dei Touch Targets Minimi ($\ge 44 \times 44$ dp)

Su smartphone Android con navigazione a gesture touch, elementi interattivi troppo piccoli causano frustrazione ed errori di tocco.

- **Altezza Minima**: Qualsiasi `Pressable`, pulsante o riga di lista deve avere una dimensione minima di **almeno 44 dp**.
- **Utilizzo di `hitSlop`**: Quando l'icona o il testo è graficamente compatto (es. un'icona da $20 \times 20$ dp), è obbligatorio applicare un margine di tocco virtuale:

```tsx
<Pressable
  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
  onPress={handleAction}
>
  <Ionicons name="heart" size={20} color={theme.colors.primary} />
</Pressable>
```

---

## 🔤 Tipografia Monospace & Caps Lock

Kuro Mobile adotta un'estetica hacker-friendly ad alto contrasto con font monospace e testi in stampatello maiuscolo:
1. **Font Monospace di Sistema**: `Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })`.
2. **Stampatello Maiuscolo (Caps Lock)**: Tutti i titoli, etichette, pulsanti, chip e informazioni sono renderizzati con `textTransform: 'uppercase'`.
3. **Bottom Tabs Solo Icone**: I pulsanti della barra inferiore non mostrano testo (`tabBarShowLabel: false`), lasciando spazio ad icone touch centrate e minimali.

---

## ⚙️ Schermata Impostazioni Minimale

La schermata impostazioni è strutturata per la massima essenzialità visiva:
- **Tema**: Griglia di pulsanti quadrati a sole icone SVG, priva di etichette testuali o descrizioni prolisse. Il tocco sul tema attivo inverte istantaneamente la modalità tra Scuro e Chiaro, con badge indicatore e contrasto YIQ automatico.
- **Sorgente**: Selezione immediata del dominio AnimeWorld tramite chip rapidi `.AC`, `.SO`, `.TV` o inserimento di un URL manuale completo.
- **Cronologia & Slider Retention**: Componente interattivo a 5 step (`OFF`, `30gg`, `60gg`, `90gg`, `ON`) per la conservazione dello storico con occultamento dinamico della tab e protezione rotta in `OFF` (`<Tabs.Protected guard={isHistoryEnabled}>`), abbinato al pulsante di svuotamento rapido della cronologia protetto da modale in-app a tema.
- **Informazioni & Changelog Scrollabile**: Dettagli su Nome, Stack, Package, Versione, Build e Architettura, accompagnati da un box del changelog scrollabile (`nestedScrollEnabled`, `maxHeight: 220`) per consultare le novità della versione corrente o in arrivo senza troncamenti.
- **Updater OTA Unificato**: Pulsante integrato in fondo alla sezione per verificare e scaricare gli aggiornamenti direttamente in-app, senza esporre URL di rete o utilizzare finestre di dialogo bloccanti.

---

## ⚡ Come Usare i Temi Dinamici (`useTheme()`)

I componenti React consumano il tema attivo tramite l'hook reattivo [`useTheme()`](file:///home/g4s/VSCode/KuroM/src/theme/unistyles.ts):

### Esempio di Utilizzo Corretto con Contrasto Dinamico

```tsx
import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { oledTheme, useTheme, getContrastTextColor } from '@/theme';

export const ActionCard = () => {
  // L'hook si aggiorna istantaneamente quando l'utente cambia tema
  const { theme } = useTheme();
  // Calcolo automatico testo chiaro/scuro in base alla luminanza YIQ dell'accento
  const textColor = getContrastTextColor(theme.colors.primary);

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>KURO MOBILE</Text>
      
      {/* Applicazione dinamica della tinta primaria con testo sempre leggibile */}
      <Pressable style={[styles.button, { backgroundColor: theme.colors.primary }]}>
        <Text style={[styles.buttonText, { color: textColor }]}>INIZIA LA VISIONE</Text>
      </Pressable>
    </View>
  );
};

// Gli stili statici non dipendenti dal colore primario usano oledTheme
const styles = StyleSheet.create({
  card: {
    backgroundColor: oledTheme.colors.surface,
    borderRadius: oledTheme.radius.md,
    padding: oledTheme.spacing.md,
    borderWidth: 1,
    borderColor: oledTheme.colors.border,
  },
    borderWidth: 1,
    borderColor: oledTheme.colors.border,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  button: {
    height: oledTheme.spacing.minTouchTarget, // 44dp
    borderRadius: oledTheme.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
});
```

### Perché Questo Pattern Evita i Problemi di Stagnazione?
In precedenza, valutare i colori direttamente all'interno di `StyleSheet.create({ container: { backgroundColor: oledTheme.colors.primary } })` fissava la proprietà al valore iniziale del modulo senza consentire a React di recepire le modifiche.

Con `useTheme()` associato al clone di riferimento nel `ThemeProvider`, ogni tap sul selettore dei temi scatena il re-render immediato delle parti colorate (bottoni, barre di avanzamento, badge e icone selezionate).

---

## 💀 Linee Guida per Animazioni Skeleton & Stati di Caricamento OLED

Gli stati di caricamento adottano scheletri pulsanti invece di spinner o schermate nere:

1. **Colori & Contrasto per Display AMOLED**:
   - **Base Surface**: `#161616` (grigio scurissimo coordinato con lo sfondo `#000000`).
   - **Bordi Strutturali**: `#262626` (sottile bordo da 1dp per definire le sagome).
2. **Animazione Pulsante a 60/120 FPS**:
   - `Animated.timing` con oscillazione di opacità continua tra $0.35$ e $0.85$ (ciclo di 850ms).
   - Esecuzione vincolata al thread nativo (`useNativeDriver: true`) per non impattare né bloccare il thread JavaScript.
3. **Regola Zero Cumulative Layout Shift (CLS) & Gestione Risorse**:
   - È vietato l'uso di skeleton con dimensioni arbitrarie. Ogni componente skeleton (`AnimeCardSkeleton`, `HomeScreenSkeleton`, `ExploreScreenSkeleton`, `AnimeDetailScreenSkeleton`, `EpisodeItemSkeleton`, `PlayerSkeleton`) deve calcolare ed ereditare le dimensioni, i margini e i border radius identici a quelli della vista effettiva.
   - Tutti i cicli `Animated.loop` devono rilasciare le risorse e arrestare l'animazione allo smontaggio del componente (`useEffect` cleanup) e all'evento `onLoad` delle immagini, per evitare consumo di batteria e cicli CPU in background.
