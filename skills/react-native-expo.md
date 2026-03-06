# React Native + Expo + NativeWind Skill

Du baust React Native Apps mit Expo SDK 54+ und NativeWind v4 fuer Styling.
Befolge diese Konfigurationen EXAKT — sie sind getestet und funktionieren.

## Projekt-Setup

### Package Installation

```bash
npx create-expo-app@latest my-app --template blank-typescript
cd my-app
npx expo install nativewind tailwindcss react-native-reanimated
npx expo install expo-router expo-linking expo-constants expo-status-bar
npx expo install @react-native-async-storage/async-storage
npm install --save-dev babel-plugin-module-resolver
```

## Konfigurationsdateien (KRITISCH)

### babel.config.js

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
          },
        },
      ],
    ],
  };
};
```

**WICHTIG:** `jsxImportSource: 'nativewind'` als Option von `babel-preset-expo` UND `'nativewind/babel'` als separates Preset. Beides ist erforderlich.

### metro.config.js

```javascript
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
```

### tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      // Projekt-spezifische Farben hier
    },
  },
  plugins: [],
};
```

### global.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### nativewind-env.d.ts

```typescript
/// <reference types="nativewind/types" />
```

### tsconfig.json (Pfad-Alias)

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts", "nativewind-env.d.ts"]
}
```

## Expo Router Ordnerstruktur

```
src/
├── app/
│   ├── _layout.tsx          # Root Layout (global.css Import HIER)
│   ├── (auth)/
│   │   ├── _layout.tsx      # Auth Stack Layout
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Tab Layout
│   │   ├── index.tsx        # Home Tab
│   │   └── settings.tsx     # Settings Tab
│   └── +not-found.tsx
├── components/
│   └── ui/                  # Wiederverwendbare UI-Komponenten
├── lib/
│   └── supabase.ts          # Supabase Client
├── store/                   # Zustand Stores
├── types/                   # TypeScript Types
└── constants/               # Theme, Config
```

### Root Layout (_layout.tsx) — global.css Import

```typescript
import '../../global.css';  // MUSS in Root Layout importiert werden

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
```

## NativeWind Styling

### Grundregeln

- Verwende `className` statt `style` wo moeglich
- Alle React Native Views unterstuetzen `className`
- Dark Mode: `className="bg-white dark:bg-slate-900"`
- Kein `styled()` Wrapper noetig bei NativeWind v4

### Beispiel-Komponente

```typescript
import { View, Text, Pressable } from 'react-native';

export function Card({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm active:opacity-80"
      onPress={onPress}
    >
      <Text className="text-lg font-semibold text-slate-900 dark:text-white">
        {title}
      </Text>
    </Pressable>
  );
}
```

### Haeufige Fehler vermeiden

- **NICHT** `tw` oder `styled` Helper verwenden — NativeWind v4 braucht das nicht
- **NICHT** `className` als String-Template mit Variablen bauen — verwende `clsx` oder bedingte Strings
- **NICHT** Web-only CSS Properties verwenden (z.B. `hover:`, `grid`, `gap` bei alten RN Versionen)
- **IMMER** `global.css` in Root `_layout.tsx` importieren, nicht in `App.tsx`

## Supabase Client Setup (React Native)

```typescript
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // WICHTIG: false fuer React Native
  },
});

// Auto-refresh bei App-Fokus
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
```

## State Management mit Zustand

```typescript
import { create } from 'zustand';

interface AppState {
  items: Item[];
  isLoading: boolean;
  setItems: (items: Item[]) => void;
  addItem: (item: Item) => void;
}

export const useAppStore = create<AppState>((set) => ({
  items: [],
  isLoading: false,
  setItems: (items) => set({ items }),
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
}));
```

## Build & Test Checkliste

Vor TASK_COMPLETE immer pruefen:

1. `npx expo export --platform web` oder `npx expo start` — kein Crash
2. `npx tsc --noEmit` — keine TypeScript Fehler
3. NativeWind Styles rendern korrekt (nicht alles weiss/unsichtbar)
4. Alle Imports aufloesbar (kein "Cannot find module")
5. `global.css` wird in Root Layout importiert
6. `nativewind-env.d.ts` existiert im Projekt-Root
