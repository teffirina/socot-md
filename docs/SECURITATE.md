# Măsuri implementate și verificări

- Parole bcrypt pe server; tokenuri de sesiune hash-uite în PostgreSQL. Sesiuni cu expirare, revocare la logout și limitarea cererilor de autentificare.
- Web: cookie HttpOnly/SameSite=Strict și Secure în producție; verificarea originii cererilor.
- Desktop: token în Keychain/Credential Manager; secretul nu este returnat JavaScript. Proxy-ul are rute permise explicit, timeout și refuză redirecturile. Release necesită HTTPS, cu verificarea certificatului.
- SQLite: AES-256-GCM cu nonce aleator și cheie OS; erorile de scriere blochează confirmarea salvării.
- Permisiuni explicite pentru opt roluri; rolurile necunoscute nu au drepturi implicite. Conturile demo nu au parole fixate în cod.
- Compania se derivează din sesiune; testele verifică izolarea între două companii și refuzul operațiunilor neautorizate.
- Idempotency, control de versiune, audit și jurnal atomic; teste pentru răspuns pierdut, concurență și perioadă închisă.
- Actualizări cu semnătură și respingerea payload-ului alterat. Cheia privată este exclusă din Git și furnizată Actions prin secret.

Aceste verificări nu reprezintă un audit independent de securitate. Restante: backup portabil/restaurare, teste de penetrare, politica de retenție și ștergere, monitorizare producție, rotație operațională a cheilor și testarea actualizării complete între versiuni. Nu există endpoint-uri de producție publicate. Domeniile propuse sunt numai configurație.
