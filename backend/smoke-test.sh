#!/bin/bash
# Smoke test semua API endpoint Shoot Points
BASE="${API_BASE:-http://localhost:8082/api/v1}"
PASS=0; FAIL=0

check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  OK   $name ($actual)"; PASS=$((PASS+1))
  else
    echo "  FAIL $name (expected $expected, got $actual)"; FAIL=$((FAIL+1))
  fi
}

code() { curl -s -o /tmp/resp.json -w "%{http_code}" "$@"; }

# Suffix unik tiap run supaya test idempotent (identitas pemain = nama + rombel)
SUF=$(printf "%06d" $((RANDOM % 1000000)))
NAME_A="Test User $SUF"
NAME_B="Zaki Tester $SUF"
NAME_B_UP="Zaki Updated $SUF"
NAME_D="Ronde Tester $SUF"

echo "=== PUBLIC ==="
check "GET leaderboard/all_time" 200 "$(code $BASE/leaderboard/all_time)"
check "GET leaderboard/weekly"   200 "$(code $BASE/leaderboard/weekly)"
check "GET leaderboard/monthly"  200 "$(code $BASE/leaderboard/monthly)"
check "GET leaderboard/invalid"  404 "$(code $BASE/leaderboard/bogus)"
check "GET simulation/config"    200 "$(code $BASE/simulation/config)"
# Jangan mengasumsikan id tertentu ada: DB produksi hanya berisi siswa asli.
# "GET players/{id} yang ada" diuji dengan pemain yang baru dibuat (NEW_ID, di bawah).
check "GET players/9999"         404 "$(code $BASE/players/9999)"
check "GET players/lookup (found)" 200 "$(code -G "$BASE/players/lookup" --data-urlencode "name=Andi" --data-urlencode "rombel=4A")"
check "GET players/lookup (no param)" 422 "$(code "$BASE/players/lookup")"

echo "=== VALIDATION ==="
check "POST players (rombel invalid)" 422 "$(code -X POST $BASE/players -H 'Content-Type: application/json' -d "{\"name\":\"$NAME_A\",\"rombel\":\"9Z\"}")"
check "POST players (rombel kosong)"  422 "$(code -X POST $BASE/players -H 'Content-Type: application/json' -d "{\"name\":\"$NAME_A\"}")"
check "POST players (short name)" 422 "$(code -X POST $BASE/players -H 'Content-Type: application/json' -d '{"name":"AB","rombel":"4A"}')"
check "POST players (valid)"      201 "$(code -X POST $BASE/players -H 'Content-Type: application/json' -d "{\"name\":\"$NAME_B\",\"rombel\":\"4A\"}")"
NEW_ID=$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['id'])")
check "POST players (nama+rombel sama)" 409 "$(code -X POST $BASE/players -H 'Content-Type: application/json' -d "{\"name\":\"$NAME_B\",\"rombel\":\"4A\"}")"
check "POST players (nama sama rombel beda)" 201 "$(code -X POST $BASE/players -H 'Content-Type: application/json' -d "{\"name\":\"$NAME_B\",\"rombel\":\"4B\"}")"
# Route publik PUT /players/{id} sudah ditutup (dulu siapa pun bisa mengubah
# nama/rombel pemain). Yang benar sekarang: 405 Method Not Allowed.
check "PUT players/$NEW_ID (publik, ditutup)" 405 "$(code -X PUT $BASE/players/$NEW_ID -H 'Content-Type: application/json' -d "{\"name\":\"$NAME_B_UP\",\"rombel\":\"4A\"}")"
check "GET players/$NEW_ID (scores)" 200 "$(code $BASE/players/$NEW_ID)"
code -G "$BASE/players/lookup" --data-urlencode "name=$NAME_B" --data-urlencode "rombel=4A" >/dev/null
check "  lookup.exists = true" True "$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['exists'])")"
code -G "$BASE/players/lookup" --data-urlencode "name=Tidak Ada $SUF" --data-urlencode "rombel=4A" >/dev/null
check "  lookup.exists = false" False "$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['exists'])")"

echo "=== ADMIN AUTH ==="
check "POST admin/login (bad)"  401 "$(code -X POST $BASE/admin/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"wrong"}')"
check "GET admin/stats (no tok)" 401 "$(code $BASE/admin/stats)"
check "POST admin/login (ok)"   200 "$(code -X POST $BASE/admin/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}')"
TOKEN=$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['token'])")
AUTH="x-admin-token: $TOKEN"

echo "=== ADMIN (authed) ==="
check "GET admin/me"            200 "$(code $BASE/admin/me -H "$AUTH")"
check "GET admin/stats"         200 "$(code $BASE/admin/stats -H "$AUTH")"
check "GET admin/players"       200 "$(code $BASE/admin/players -H "$AUTH")"
check "GET admin/players?search" 200 "$(code "$BASE/admin/players?search=Andi" -H "$AUTH")"
check "GET admin/logs"          200 "$(code $BASE/admin/logs -H "$AUTH")"
check "GET admin/games/recent"  200 "$(code $BASE/admin/games/recent -H "$AUTH")"
check "GET admin/games/player/1" 200 "$(code $BASE/admin/games/player/1 -H "$AUTH")"

echo "=== ADMIN TAMBAH SISWA + ROSTER (lapangan A → B) ==="
ADD_NAME="Siswa Baru $SUF"
check "GET players/roster (tanpa rombel)"   422 "$(code $BASE/players/roster)"
check "GET players/roster (rombel invalid)" 422 "$(code "$BASE/players/roster?rombel=9Z")"
check "POST admin/players (tanpa token)"    401 "$(code -X POST $BASE/admin/players -H 'Content-Type: application/json' -d "{\"rombel\":\"5A\",\"names\":[\"$ADD_NAME\"]}")"
check "POST admin/players (rombel invalid)" 422 "$(code -X POST $BASE/admin/players -H 'Content-Type: application/json' -H "$AUTH" -d "{\"rombel\":\"9Z\",\"names\":[\"$ADD_NAME\"]}")"
check "POST admin/players (names kosong)"   422 "$(code -X POST $BASE/admin/players -H 'Content-Type: application/json' -H "$AUTH" -d '{"rombel":"5A","names":[]}')"
check "POST admin/players (1 nama, string)" 201 "$(code -X POST $BASE/admin/players -H 'Content-Type: application/json' -H "$AUTH" -d "{\"rombel\":\"5A\",\"names\":\"$ADD_NAME\"}")"
check "  -> added"                          1 "$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['added'])")"
check "POST admin/players (ulang = duplikat)" 201 "$(code -X POST $BASE/admin/players -H 'Content-Type: application/json' -H "$AUTH" -d "{\"rombel\":\"5A\",\"names\":\"$ADD_NAME\"}")"
check "  -> duplicate (tidak bikin akun baru)" 1 "$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['duplicate'])")"
check "POST admin/players (rombel huruf kecil)" 201 "$(code -X POST $BASE/admin/players -H 'Content-Type: application/json' -H "$AUTH" -d "{\"rombel\":\"5a\",\"names\":[\"$ADD_NAME 2\",\"Ab\"]}")"
check "  -> rombel dinormalkan + nama pendek dilewati" "5A:1:1" "$(python3 -c "import json;d=json.load(open('/tmp/resp.json'))['data'];print(f\"{d['rombel']}:{d['added']}:{d['invalid']}\")")"
check "GET players/roster 5A"               200 "$(code "$BASE/players/roster?rombel=5A")"
check "  -> nama baru muncul di roster"     yes "$(python3 -c "import json;d=json.load(open('/tmp/resp.json'))['data'];print('yes' if any(p['name']=='$ADD_NAME' for p in d['players']) else 'no')")"
# Siswa buatan admin harus bisa langsung dipakai: input skor manual tanpa registrasi app dulu.
ADD_ID=$(curl -s -G "$BASE/players/lookup" --data-urlencode "name=$ADD_NAME" --data-urlencode "rombel=5A" | python3 -c "import json;print(json.load(open('/dev/stdin'))['data']['player']['id'])")
check "POST admin/games utk siswa buatan admin" 201 "$(code -X POST $BASE/admin/games -H 'Content-Type: application/json' -H "$AUTH" -d "{\"player_id\":$ADD_ID,\"attempt_number\":1,\"is_successful\":true,\"points\":50,\"zone_name\":\"h09\",\"game_mode\":\"manual\"}")"

echo "=== IMPORT SISWA MASSAL (tempel dari Excel + unggah berkas) ==="
IMP_A="Import Tempel $SUF"
IMP_B="Import Tempel $SUF Dua"
IMP_C="Import Xlsx $SUF"
DIR_TES="$(cd "$(dirname "$0")" && pwd)"

# Tempelan gaya Excel: ada baris judul, kolom nomor, pemisah TAB, dan kolom
# rombel — bentuk yang paling sering bikin daftar gagal terbaca kalau parser naif.
printf 'No\tNama Siswa\tRombel\n1\t%s\t5A\n2\t%s\t6B\n' "$IMP_A" "$IMP_B" > /tmp/import-paste.txt
# Dua payload: satu untuk memeriksa (dry_run), satu untuk benar-benar menyimpan.
PASTE=$(python3 -c "import json;print(json.dumps({'text':open('/tmp/import-paste.txt').read(),'dry_run':True}))")
SIMPAN=$(python3 -c "import json;print(json.dumps({'text':open('/tmp/import-paste.txt').read(),'dry_run':False}))")

check "POST import (periksa dulu)"  200 "$(code -X POST $BASE/admin/players/import -H 'Content-Type: application/json' -H "$AUTH" -d "$PASTE")"
check "  -> 2 siswa terdeteksi"     2   "$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['added'])")"
check "  -> rombel 5A & 6B terbaca" "5A,6B" "$(python3 -c "import json;print(','.join(json.load(open('/tmp/resp.json'))['data']['by_rombel']))")"
check "  -> belum ditulis ke DB"    0   "$(curl -s "$BASE/players/roster?rombel=6B" | python3 -c "import json,sys;print(sum(1 for p in json.load(sys.stdin)['data']['players'] if p['name']=='$IMP_B'))")"

check "POST import (simpan)"        201 "$(code -X POST $BASE/admin/players/import -H 'Content-Type: application/json' -H "$AUTH" -d "$SIMPAN")"
check "  -> 2 siswa ditambahkan"    2   "$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['added'])")"
check "POST import (daftar sama lagi)" 201 "$(code -X POST $BASE/admin/players/import -H 'Content-Type: application/json' -H "$AUTH" -d "$SIMPAN")"
check "  -> jadi duplikat"          2   "$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['duplicate'])")"
check "  -> tidak bikin akun baru"  0   "$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['added'])")"

# Hanya kolom nama + rombel bawaan dari dropdown
BARE=$(python3 -c "import json;print(json.dumps({'text':'$IMP_A Tiga\n$IMP_A Empat','rombel':'5A'}))")
check "POST import (1 kolom + rombel bawaan)" 201 "$(code -X POST $BASE/admin/players/import -H 'Content-Type: application/json' -H "$AUTH" -d "$BARE")"
check "  -> 2 siswa ditambahkan"    2   "$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['added'])")"

check "POST import (tanpa isi)"     422 "$(code -X POST $BASE/admin/players/import -H 'Content-Type: application/json' -H "$AUTH" -d '{}')"
check "POST import (tanpa token)"   401 "$(code -X POST $BASE/admin/players/import -H 'Content-Type: application/json' -d "$PASTE")"
check "POST import (rombel invalid)" 422 "$(code -X POST $BASE/admin/players/import -H 'Content-Type: application/json' -H "$AUTH" -d '{"text":"Nama Panjang Sekali","rombel":"9Z"}')"

# Berkas .xlsx asli (dibuat saat test) — parser membaca zip + XML tanpa library
python3 "$DIR_TES/tests/make-xlsx.py" /tmp/import-uji.xlsx "$IMP_C:5A" > /dev/null
check "POST import (unggah .xlsx)"  201 "$(code -X POST $BASE/admin/players/import -H "$AUTH" -F "file=@/tmp/import-uji.xlsx")"
check "  -> 1 siswa ditambahkan"    1   "$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['added'])")"

# .xls lama tidak didukung: harus pesan jelas (422), bukan error 500
echo "bukan excel" > /tmp/import-lama.xls
check "POST import (.xls lama ditolak)" 422 "$(code -X POST $BASE/admin/players/import -H "$AUTH" -F "file=@/tmp/import-lama.xls")"
check "  -> kode IMPORT_UNREADABLE" IMPORT_UNREADABLE "$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['error']['code'])")"

# Aturan rombel 1A-6B dikunci di sini: baris ber-rombel lain (mis. 5C) harus
# DILAPORKAN sebagai tidak terbaca, bukan disimpan diam-diam.
TOLAK=$(python3 -c "import json;print(json.dumps({'text':'Gilang Pratama\t5C','dry_run':True}))")
check "POST import (rombel 5C ditolak)" 200 "$(code -X POST $BASE/admin/players/import -H 'Content-Type: application/json' -H "$AUTH" -d "$TOLAK")"
check "  -> 0 siswa ditambahkan"        0   "$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['added'])")"
check "  -> 1 baris tidak terbaca"      1   "$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['invalid'])")"

echo "=== MANUAL SCORE INPUT (5 attempts) ==="
for i in 1 2 3 4 5; do
  check "POST admin/games attempt $i" 201 "$(code -X POST $BASE/admin/games -H 'Content-Type: application/json' -H "$AUTH" -d "{\"player_id\":$NEW_ID,\"attempt_number\":$i,\"is_successful\":true,\"points\":30,\"zone_name\":\"h13\",\"game_mode\":\"manual\"}")"
done
echo "  -> round result: $(python3 -c "import json;d=json.load(open('/tmp/resp.json'))['data']['round'];print(f\"score={d['total_score']} attempts={d['attempts_count']} complete={d['is_complete']}\")")"

echo "=== SIMULATION ==="
check "POST simulation/rounds" 201 "$(code -X POST $BASE/simulation/rounds -H 'Content-Type: application/json' -d "{\"player_id\":$NEW_ID,\"attempts\":[{\"attempt_number\":1,\"is_successful\":true,\"points\":100,\"zone_name\":\"h01\"},{\"attempt_number\":2,\"is_successful\":true,\"points\":30,\"zone_name\":\"h13\"},{\"attempt_number\":3,\"is_successful\":false,\"points\":0},{\"attempt_number\":4,\"is_successful\":true,\"points\":20,\"zone_name\":\"h02\"},{\"attempt_number\":5,\"is_successful\":true,\"points\":15,\"zone_name\":\"h03\"}]}")"
echo "  -> $(python3 -c "import json;d=json.load(open('/tmp/resp.json'))['data'];print(f\"score={d['round']['total_score']} rank={d['estimated_rank']} podium={d['is_podium']}\")")"
check "GET player final score" 200 "$(code $BASE/players/$NEW_ID)"
check "  final = manual 150 + simulasi 165" 315 "$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['stats']['final_score'])")"
check "  status dua mode complete" complete "$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['stats']['completion_status'])")"
check "POST simulation (only 3 attempts)" 422 "$(code -X POST $BASE/simulation/rounds -H 'Content-Type: application/json' -d "{\"player_id\":$NEW_ID,\"attempts\":[{\"attempt_number\":1,\"is_successful\":true,\"points\":10}]}")"

echo "=== VALIDASI PAPAN ==="
check "GET simulation/config" 200 "$(code $BASE/simulation/config)"
check "  jumlah lubang" 20 "$(python3 -c "import json;print(len(json.load(open('/tmp/resp.json'))['data']['holes']))")"
check "  max_round_score" 500 "$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['max_round_score'])")"
check "poin tidak cocok lubang"  422 "$(code -X POST $BASE/admin/games -H 'Content-Type: application/json' -H "$AUTH" -d "{\"player_id\":$NEW_ID,\"attempt_number\":1,\"is_successful\":true,\"points\":999,\"zone_name\":\"h20\",\"game_mode\":\"manual\"}")"
check "lubang tidak dikenal"     422 "$(code -X POST $BASE/admin/games -H 'Content-Type: application/json' -H "$AUTH" -d "{\"player_id\":$NEW_ID,\"attempt_number\":1,\"is_successful\":true,\"points\":10,\"zone_name\":\"h99\",\"game_mode\":\"manual\"}")"
check "masuk tanpa pilih lubang" 422 "$(code -X POST $BASE/admin/games -H 'Content-Type: application/json' -H "$AUTH" -d "{\"player_id\":$NEW_ID,\"attempt_number\":1,\"is_successful\":true,\"points\":30,\"game_mode\":\"manual\"}")"
check "h03 dgn poin palsu"        422 "$(code -X POST $BASE/admin/games -H 'Content-Type: application/json' -H "$AUTH" -d "{\"player_id\":$NEW_ID,\"attempt_number\":1,\"is_successful\":true,\"points\":50,\"zone_name\":\"h03\",\"game_mode\":\"manual\"}")"

echo "=== RONDE MANUAL LENGKAP (jackpot + bonus + meleset) ==="
# pemain baru supaya ronde bersih
code -X POST $BASE/players -H 'Content-Type: application/json' -d "{\"name\":\"$NAME_D\",\"rombel\":\"5A\"}" >/dev/null
RID=$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['id'])")
g() { code -X POST $BASE/admin/games -H 'Content-Type: application/json' -H "$AUTH" -d "{\"player_id\":$RID,\"attempt_number\":$4,\"is_successful\":$3,\"points\":$2,\"zone_name\":\"$1\",\"game_mode\":\"manual\"}"; }
check "att1 jackpot h01 (100)" 201 "$(g h01 100 true 1)"
check "att2 h20 (10)"          201 "$(g h20 10 true 2)"
check "att3 h03 (15)"           201 "$(g h03 15 true 3)"
check "att4 meleset"           201 "$(g '' 0 false 4)"
check "att5 h18 (50)"          201 "$(g h18 50 true 5)"
check "  total ronde (100+10+15+0+50)" 175 "$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['round']['total_score'])")"
check "  ronde ditutup"        True "$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['round']['is_complete'])")"

# NEW_ID sudah punya ronde simulasi resmi — percobaan kedua wajib ditolak.
check "simulasi kedua ditolak" 409 "$(code -X POST $BASE/simulation/rounds -H 'Content-Type: application/json' -d "{\"player_id\":$NEW_ID,\"attempts\":[{\"attempt_number\":1,\"is_successful\":false},{\"attempt_number\":2,\"is_successful\":false},{\"attempt_number\":3,\"is_successful\":false},{\"attempt_number\":4,\"is_successful\":false},{\"attempt_number\":5,\"is_successful\":false}]}")"
check "simulasi lubang tak dikenal" 422 "$(code -X POST $BASE/simulation/rounds -H 'Content-Type: application/json' -d "{\"player_id\":$NEW_ID,\"attempts\":[{\"attempt_number\":1,\"is_successful\":true,\"points\":10,\"zone_name\":\"h99\"},{\"attempt_number\":2,\"is_successful\":false,\"points\":0},{\"attempt_number\":3,\"is_successful\":false,\"points\":0},{\"attempt_number\":4,\"is_successful\":false,\"points\":0},{\"attempt_number\":5,\"is_successful\":false,\"points\":0}]}")"

echo "=== LEADERBOARD PER KELAS + POSISI KAMU ==="
check "GET leaderboard?rombel=4A" 200 "$(code "$BASE/leaderboard/all_time?rombel=4A")"
check "  data.rombel = 4A" 4A "$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['rombel'])")"
check "  semua baris kelas 4A" True "$(python3 -c "import json;print(all(p['rombel']=='4A' for p in json.load(open('/tmp/resp.json'))['data']['top_players']))")"
check "GET leaderboard (rombel invalid)" 400 "$(code "$BASE/leaderboard/all_time?rombel=9Z")"
check "GET leaderboard (limit=3)" 3 "$(code "$BASE/leaderboard/all_time?limit=3" >/dev/null; python3 -c "import json;print(len(json.load(open('/tmp/resp.json'))['data']['top_players']))")"
check "GET leaderboard?player_id" 200 "$(code "$BASE/leaderboard/all_time?player_id=$NEW_ID")"
check "  you.player_id cocok" "$NEW_ID" "$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['you']['player_id'])")"
check "  you.final_score > 0" True "$(python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['you']['final_score']>0)")"
check "  you tetap ada walau limit=1" True "$(code "$BASE/leaderboard/all_time?player_id=$NEW_ID&limit=1" >/dev/null; python3 -c "import json;d=json.load(open('/tmp/resp.json'))['data'];print(d['you'] is not None and len(d['top_players'])==1)")"

echo "=== HAPUS PEMAIN (bersih-bersih data uji) ==="
# Endpoint hapus pemain harus tertutup untuk publik.
check "DELETE admin/players/{id} (tanpa token)" 401 "$(code -X DELETE $BASE/admin/players/$NEW_ID)"
check "DELETE admin/players/999999 (tidak ada)" 404 "$(code -X DELETE $BASE/admin/players/999999 -H "$AUTH")"

# Tiap run memakai $SUF unik, jadi semua akun uji run ini memuat $SUF di namanya.
# Disapu di sini supaya smoke-test tidak menumpuk "Zaki Updated"/"Import Tempel"/
# "Siswa Baru" di leaderboard setiap kali dijalankan.
UJI_IDS=$(curl -s "$BASE/admin/players?search=$SUF&per_page=1000" -H "$AUTH" \
  | python3 -c "import json,sys;print(' '.join(str(p['id']) for p in json.load(sys.stdin)['data']['players']))")
echo "  -> $(( $(echo "$UJI_IDS" | wc -w) )) pemain uji dihapus"
for id in $UJI_IDS; do
  code -X DELETE "$BASE/admin/players/$id" -H "$AUTH" > /dev/null
done

SISA=$(curl -s "$BASE/admin/players?search=$SUF&per_page=1000" -H "$AUTH" \
  | python3 -c "import json,sys;print(len(json.load(sys.stdin)['data']['players']))")
check "  -> 0 pemain uji tersisa" 0 "$SISA"
check "  -> GET players/$NEW_ID jadi 404" 404 "$(code $BASE/players/$NEW_ID)"
check "  -> hilang dari leaderboard" True "$(code "$BASE/leaderboard/all_time?player_id=$NEW_ID" >/dev/null; python3 -c "import json;print(json.load(open('/tmp/resp.json'))['data']['you'] is None)")"

echo "=== LOGOUT ==="
check "POST admin/logout"       200 "$(code -X POST $BASE/admin/logout -H "$AUTH")"
check "GET admin/stats (revoked)" 401 "$(code $BASE/admin/stats -H "$AUTH")"

echo ""
echo "RESULT: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ] || exit 1
