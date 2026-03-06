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

## Supabase Projekt-Setup (Automatisch)

Wenn der Task ein Supabase-Backend braucht, erstelle das Projekt automatisch per Management API.
Env-Var `$SUPABASE_ACCESS_TOKEN` ist gesetzt.

### 1. Projekt erstellen

```bash
curl -s -X POST "https://api.supabase.com/v1/projects" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PROJECT_NAME",
    "organization_id": "lwlafcjzibqiroqexvhh",
    "region": "eu-central-1",
    "db_pass": "GENERATE_SECURE_PASSWORD",
    "plan": "free"
  }'
```

Speichere die `ref` aus der Response (= Projekt-ID).

### 2. API Keys holen

```bash
curl -s "https://api.supabase.com/v1/projects/{ref}/api-keys" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

Speichere `anon` key und `service_role` key.

### 3. SQL Migrationen ausfuehren

```bash
# Pro Migration-Datei:
curl -s -X POST "https://api.supabase.com/v1/projects/{ref}/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "CREATE TABLE ..."}'
```

### 4. .env schreiben

```bash
cat > .env << EOF
EXPO_PUBLIC_SUPABASE_URL=https://{ref}.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY={anon_key}
EOF
```

### 5. Verifizieren

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/{ref}/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT table_name FROM information_schema.tables WHERE table_schema = '\''public'\''"}'
```

### 6. Deliverable registrieren

Registriere das Supabase-Projekt als Deliverable in MC:
```bash
curl -s -X POST "$MISSION_CONTROL_URL/api/tasks/$TASK_ID/deliverables" \
  -H "Content-Type: application/json" \
  -d '{"type":"supabase_project","url":"https://supabase.com/dashboard/project/{ref}","metadata":{"ref":"{ref}","org":"lwlafcjzibqiroqexvhh"}}'
```

## Integration Tests

Fuer Supabase-abhaengige Apps schreibe Integration Tests mit dem Service Role Key:

```typescript
// tests/supabase.test.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Admin-Zugang fuer Tests
);

describe('Supabase Integration', () => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPass123!';

  test('Sign up creates user + profile', async () => {
    const { data, error } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { display_name: 'Test User' }
    });
    expect(error).toBeNull();
    expect(data.user).toBeDefined();

    // Profile sollte per Trigger erstellt worden sein
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user!.id)
      .single();
    expect(profile).toBeDefined();
    expect(profile!.display_name).toBe('Test User');
  });

  afterAll(async () => {
    // Cleanup: Test-User loeschen
    const { data: users } = await supabase.auth.admin.listUsers();
    for (const user of users.users) {
      if (user.email?.startsWith('test-')) {
        await supabase.auth.admin.deleteUser(user.id);
      }
    }
  });
});
```

Test-Framework Setup:
```bash
npm install -D vitest @supabase/supabase-js
```

```json
// package.json scripts
"test": "vitest run",
"test:watch": "vitest"
```

## Build & Test Checkliste

Vor TASK_COMPLETE immer pruefen:

1. `npx tsc --noEmit` — keine TypeScript Fehler
2. `npm run build` oder `npx expo export --platform web` — kein Crash
3. `npm test` — Integration Tests bestehen
4. Supabase-Tabellen existieren (SQL Query Verifizierung)
5. Alle Imports aufloesbar (kein "Cannot find module")
6. `global.css` wird in Root Layout importiert
7. `nativewind-env.d.ts` existiert im Projekt-Root
8. `.env` hat korrekte Supabase-Credentials
