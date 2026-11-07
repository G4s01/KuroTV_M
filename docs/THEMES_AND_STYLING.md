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

## ⚡ Come Usare i Temi Dinamici (`useTheme()`)

I componenti React consumano il tema attivo tramite l'hook reattivo [`useTheme()`](file:///home/g4s/VSCode/KuroM/src/theme/unistyles.ts):

### Esempio di Utilizzo Corretto

```tsx
import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { oledTheme, useTheme } from '@/theme';

export const ActionCard = () => {
  // L'hook si aggiorna istantaneamente quando l'utente cambia tema
  const { theme } = useTheme();

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Kuro Mobile</Text>
      
      {/* Applicazione dinamica della tinta primaria */}
      <Pressable style={[styles.button, { backgroundColor: theme.colors.primary }]}>
        <Text style={styles.buttonText}>Inizia la Visione</Text>
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
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
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
  },
});
```

### Perché Questo Pattern Evita i Problemi di Stagnazione?
In precedenza, valutare i colori direttamente all'interno di `StyleSheet.create({ container: { backgroundColor: oledTheme.colors.primary } })` fissava la proprietà al valore iniziale del modulo senza consentire a React di recepire le modifiche.

Con `useTheme()` associato al clone di riferimento nel `ThemeProvider`, ogni tap sul selettore dei temi scatena il re-render immediato delle parti colorate (bottoni, barre di avanzamento, badge e icone selezionate).
