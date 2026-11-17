# KeyVault – slaptažodžių tvarkyklės Chrome plėtinys (MVP)

Chrome plėtinys (Manifest V3), sukurtas su **Vite + React**, ir **FastAPI** backendas.

## Kas veikia

| Funkcija | Aprašymas |
| --- | --- |
| **Prisijungimas / registracija** | Paskyra su el. paštu ir pagrindiniu slaptažodžiu. Iš slaptažodžio PBKDF2-SHA256 (600 000 iteracijų naujoms paskyroms) būdu išvedamas AES-256-GCM raktas, juo šifruojama visa saugykla. Užrakinimo mygtukas, „Atsiminti el. paštą“. |
| **Saugykla** | Visų slaptažodžių sąrašas, paieška (pavadinimas, vartotojas, svetainė), filtrai (Visi, Mėgstami, Darbas, Socialiniai, Asmeninis), sekcija „Šiai svetainei“, slaptažodžio kopijavimas, įrašų kūrimas, redagavimas ir trynimas. |
| **Formos aptikimas** | Content script'as pastebi prisijungimo formos pateikimą ir puslapyje parodo kortelę „Išsaugoti slaptažodį?“. Paspaudus „Išsaugoti“ atsidaro plėtinys su užpildytu įrašo pridėjimo puslapiu. Jei slaptažodis pasikeitė, siūloma įrašą atnaujinti. |
| **Automatinis užpildymas pagal URL** | Atidarius puslapį su prisijungimo forma, kuriam yra išsaugotų prisijungimų, parodoma kortelė su jais. Paspaudus „Įterpti“ užpildomi vartotojo vardo ir slaptažodžio laukai. Taip pat galima įterpti iš popup lango sekcijos „Šiai svetainei“. |
| **Nustatymai** | Įjungti / išjungti pasiūlymus išsaugoti ir užpildyti, ištrinti paskyrą. |

Slaptažodžių generatorius šiame etape praleistas (navigacijoje pažymėtas „Netrukus“).

## Paleidimas

Reikia **Node.js 20+**, **Python 3.11+** ir **Google Chrome** (arba kitos Chromium naršyklės).

```bash
git clone <repozitorijos-adresas> keyvault-extension
cd keyvault-extension
npm install
npm run build
```

Backend paleidimas atskirame terminale:

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Backend veikia adresu `http://127.0.0.1:8000`, o jo Swagger dokumentacija – `http://127.0.0.1:8000/docs`.
Prieš registruojantis ar atrakinant plėtinį backend turi būti paleistas.

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
    vault-service.js     FastAPI klientas, šifravimas, CRUD ir formų aptikimo logika
    demo-data.js         demonstraciniai įrašai
  content/
    index.js             formų aptikimas ir automatinis užpildymas puslapyje
    ui.js                in-page kortelės (Shadow DOM)
  lib/                   API klientas, crypto, chrome.storage wrapper, URL, stiprumas
backend/
  main.py                FastAPI autentifikacija ir šifruotos saugyklos API
  requirements.txt       Python priklausomybės
demo/                    lokali testinė prisijungimo svetainė (npm run demo)
vite.config.js           popup + background build'as
vite.content.config.js   content script'o build'as (IIFE)
```

### Kaip veikia backend integracija

UI niekada tiesiogiai neliečia saugyklos. Visi veiksmai siunčiami žinutėmis į background service worker'į
(`src/lib/messages.js` → `src/background/index.js`), kuris kviečia `vault-service.js`. Šis per `src/lib/api.js`
bendrauja su FastAPI serveriu. Pagrindinis slaptažodis ir AES raktas serveriui nesiunčiami: plėtinys išveda
atskirą autentifikacijos paslaptį, o serveris saugo tik Argon2 maišą bei AES-GCM užšifruotą vault blobą.

| Raktas | Kur | Turinys |
| --- | --- | --- |
| `kv:settings` | `chrome.storage.local` | nustatymai |
| `kv:session` | `chrome.storage.session` | AES raktas, JWT ir vault versija; dingsta uždarius naršyklę |
| `kv:pending`, `kv:draft` | `chrome.storage.session` | aptikti, dar neišsaugoti prisijungimai |

Serverio SQLite duomenų bazėje laikomi vartotojo el. paštas, kriptografinė druska, PBKDF2 iteracijų skaičius, autentifikacijos maiša,
užšifruotas vault tekstas, AES-GCM IV ir optimistinio sinchronizavimo versija.
