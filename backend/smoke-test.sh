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
check "GET players/1"            200 "$(code $BASE/players/1)"
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
check "PUT players/$NEW_ID"       200 "$(code -X PUT $BASE/players/$NEW_ID -H 'Content-Type: application/json' -d "{\"name\":\"$NAME_B_UP\",\"rombel\":\"4A\"}")"
check "GET players/$NEW_ID (scores)" 200 "$(code $BASE/players/$NEW_ID)"
code -G "$BASE/players/lookup" --data-urlencode "name=$NAME_B_UP" --data-urlencode "rombel=4A" >/dev/null
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

echo "=== LOGOUT ==="
check "POST admin/logout"       200 "$(code -X POST $BASE/admin/logout -H "$AUTH")"
check "GET admin/stats (revoked)" 401 "$(code $BASE/admin/stats -H "$AUTH")"

echo ""
echo "RESULT: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ] || exit 1
