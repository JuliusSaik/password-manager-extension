# KeyVault – slaptažodžių tvarkyklės Chrome plėtinys (MVP)

Chrome plėtinys (Manifest V3), sukurtas su **Vite + React**. Tai tik frontend dalis:
backend'as ir duomenų bazė imituojami naršyklės `chrome.storage` saugykloje.

## Kas veikia

| Funkcija | Aprašymas |
| --- | --- |
| **Prisijungimas / registracija** | Paskyra su el. paštu ir pagrindiniu slaptažodžiu. Iš slaptažodžio PBKDF2 (310 000 iteracijų) būdu išvedamas AES-256-GCM raktas, juo šifruojama visa saugykla. Užrakinimo mygtukas, „Atsiminti el. paštą“. |
| **Saugykla** | Visų slaptažodžių sąrašas, paieška (pavadinimas, vartotojas, svetainė), filtrai (Visi, Mėgstami, Darbas, Socialiniai, Asmeninis), sekcija „Šiai svetainei“, slaptažodžio kopijavimas, įrašų kūrimas, redagavimas ir trynimas. |
| **Formos aptikimas** | Content script'as pastebi prisijungimo formos pateikimą ir puslapyje parodo kortelę „Išsaugoti slaptažodį?“. Paspaudus „Išsaugoti“ atsidaro plėtinys su užpildytu įrašo pridėjimo puslapiu. Jei slaptažodis pasikeitė, siūloma įrašą atnaujinti. |
| **Automatinis užpildymas pagal URL** | Atidarius puslapį su prisijungimo forma, kuriam yra išsaugotų prisijungimų, parodoma kortelė su jais. Paspaudus „Įterpti“ užpildomi vartotojo vardo ir slaptažodžio laukai. Taip pat galima įterpti iš popup lango sekcijos „Šiai svetainei“. |
| **Nustatymai** | Įjungti / išjungti pasiūlymus išsaugoti ir užpildyti, ištrinti paskyrą. |

Slaptažodžių generatorius šiame etape praleistas (navigacijoje pažymėtas „Netrukus“).

## Paleidimas

Reikia **Node.js 20+** ir **Google Chrome** (arba kitos Chromium naršyklės).

```bash
git clone <repozitorijos-adresas> keyvault-extension
cd keyvault-extension
npm install
npm run build
```

Tada įkelkite plėtinį į Chrome:

1. Atidarykite `chrome://extensions`.
2. Įjunkite **Developer mode** (viršuje dešinėje).
3. Spauskite **Load unpacked** ir pasirinkite sugeneruotą `dist` aplanką.
4. Prisekite KeyVault ikoną įrankių juostoje (dėlionės ikona → smeigtukas).

Pakeitus kodą, paleiskite `npm run build` iš naujo ir `chrome://extensions` puslapyje paspauskite plėtinio atnaujinimo (↻) mygtuką.
Kūrimo metu galima naudoti `npm run dev`: popup ir background persibuildina automatiškai, o pakeitus content script'ą reikia paleisti `npm run build:content`.

## Kaip pademonstruoti

1. Spauskite KeyVault ikoną → **Registruotis**, įveskite el. paštą ir pagrindinį slaptažodį (bent 8 simboliai).
   Palikite pažymėtą „Pridėti demonstracinius įrašus“, kad saugykla nebūtų tuščia.
2. **Saugykla ir paieška:** įveskite pvz. „net“ paieškoje, išbandykite filtrus, paspauskite ant įrašo, kad jį redaguotumėte.
3. **Formos aptikimas:** paleiskite demo svetainę
   ```bash
   npm run demo
   ```
   atidarykite http://localhost:4321, įveskite bet kokį el. paštą ir slaptažodį, paspauskite „Prisijungti“.
   Viršuje dešinėje atsiras „Išsaugoti slaptažodį?“ → **Išsaugoti** → atsidarys užpildytas „Naujas įrašas“.
4. **Automatinis užpildymas:** grįžkite į http://localhost:4321. Atsiras kortelė „Prisijungti su KeyVault“ → **Įterpti**.
   Taip pat galima tiesiog atidaryti popup'ą – sekcijoje „Šiai svetainei“ yra įterpimo mygtukas.

Demonstraciniuose įrašuose yra ir https://the-internet.herokuapp.com/login (`tomsmith` / `SuperSecretPassword!`), tad automatinį užpildymą galima parodyti ir realioje svetainėje.

## Projekto struktūra

```
public/
  manifest.json          Manifest V3 aprašas
  icons/                 plėtinio ikonos
index.html               popup langas (360×600)
src/
  popup/                 React UI
    App.jsx              ekranų perjungimas (login / saugykla / įrašas / nustatymai)
    pages/               Login, Vault, EntryForm, Settings
    components/          ikonos, avatarai, toast, apatinė navigacija
    styles.css           tamsi tema pagal maketus
  background/
    index.js             service worker – žinučių maršrutizatorius („API“)
    vault-service.js     MOCK BACKEND: vartotojai, šifravimas, CRUD, formų aptikimo logika
    demo-data.js         demonstraciniai įrašai
  content/
    index.js             formų aptikimas ir automatinis užpildymas puslapyje
    ui.js                in-page kortelės (Shadow DOM)
  lib/                   bendras kodas: crypto, chrome.storage wrapper, URL, stiprumas
demo/                    lokali testinė prisijungimo svetainė (npm run demo)
vite.config.js           popup + background build'as
vite.content.config.js   content script'o build'as (IIFE)
```

### Kaip veikia „mock backend“

UI niekada tiesiogiai neliečia saugyklos. Visi veiksmai siunčiami žinutėmis į background service worker'į
(`src/lib/messages.js` → `src/background/index.js`), kuris kviečia `vault-service.js`.
Norint prijungti tikrą serverį, užtenka `vault-service.js` funkcijas pakeisti `fetch` kvietimais. UI keisti nereikės.

| Raktas | Kur | Turinys |
| --- | --- | --- |
| `kv:users` | `chrome.storage.local` | vartotojai: druska ir šifruotas tikrinimo blokas |
| `kv:vault:<email>` | `chrome.storage.local` | AES-GCM šifruotas įrašų masyvas |
| `kv:settings` | `chrome.storage.local` | nustatymai |
| `kv:session` | `chrome.storage.session` | atrakinimo raktas (tik atmintyje, dingsta uždarius naršyklę) |
| `kv:pending`, `kv:draft` | `chrome.storage.session` | aptikti, dar neišsaugoti prisijungimai |

> ⚠️ Tai MVP demonstracijai. Pagrindinio slaptažodžio atkurti neįmanoma, o duomenys saugomi tik šioje naršyklėje.
