# Deno Edge Functions - VS Code Setup

## TypeScript Errors Fix

Jika Anda melihat error TypeScript seperti:
- `Cannot find module 'https://deno.land/std@0.168.0/http/server.ts'`
- `Cannot find module 'https://esm.sh/@supabase/supabase-js@2'`
- `Cannot find name 'Deno'`

**Ini adalah false positive dari IDE** - code akan berjalan normal di Deno runtime.

## Setup VS Code untuk Deno

### 1. Install Deno Extension

Pastikan extension Deno sudah terinstall:
- Extension ID: `denoland.vscode-deno`
- Atau search "Deno" di VS Code Extensions

### 2. Enable Deno untuk Workspace

**Option A: Command Palette**
1. Tekan `Ctrl+Shift+P` (Windows) atau `Cmd+Shift+P` (Mac)
2. Ketik: `Deno: Initialize Workspace Configuration`
3. Pilih folder `backend/supabase/functions`

**Option B: Manual Settings**

Buat file `.vscode/settings.json` di root project dengan:

```json
{
  "deno.enable": true,
  "deno.enablePaths": [
    "./backend/supabase/functions"
  ],
  "deno.lint": true,
  "deno.unstable": false,
  "deno.config": "./backend/supabase/functions/deno.json"
}
```

### 3. Reload VS Code

Setelah konfigurasi, reload VS Code:
- `Ctrl+Shift+P` → `Developer: Reload Window`

## Verifikasi

Setelah setup, Anda seharusnya melihat:
- ✅ No TypeScript errors di Edge Functions
- ✅ Auto-complete untuk Deno APIs
- ✅ Import suggestions untuk Deno modules

## Catatan Penting

- **Edge Functions berjalan di Deno**, bukan Node.js
- **Imports dari URL adalah valid** di Deno
- **`Deno` global tersedia** di runtime
- **TypeScript errors di IDE tidak mempengaruhi runtime**

## Testing Edge Functions

Untuk test Edge Functions locally:

```bash
# Start Supabase local
supabase start

# Test specific function
supabase functions serve receive-raw-material --env-file ./backend/supabase/.env.local

# Deploy to production
supabase functions deploy receive-raw-material
```

## Troubleshooting

**Jika masih ada errors:**

1. **Restart Deno Language Server**
   - `Ctrl+Shift+P` → `Deno: Restart Language Server`

2. **Check Deno Extension Status**
   - Lihat status bar di bawah VS Code
   - Seharusnya ada "Deno" indicator

3. **Verify deno.json exists**
   - File `backend/supabase/functions/deno.json` harus ada
   - Berisi konfigurasi Deno

4. **Ignore Errors (Last Resort)**
   - Errors ini tidak mempengaruhi runtime
   - Code akan berjalan normal di Supabase

## Referensi

- [Deno VS Code Extension](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno)
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Manual](https://deno.land/manual)
