#!/bin/bash
set -e

URL="http://localhost:3000/api/dev/chat"
SECRET="185cd47094c024f97b846e7d73b4d16f"

declare -i pass=0 fail=0

run_test() {
  local name="$1" userId="$2" text="$3"
  local tmpfile=$(mktemp)
  local http_code time_total
  
  read -r http_code time_total < <(curl -s -o "$tmpfile" -w '%{http_code} %{time_total}' \
    -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "x-dev-secret: $SECRET" \
    -d "{\"userId\":\"$userId\",\"text\":\"$text\"}")
  
  echo "=== $name ==="
  echo "HTTP: $http_code  Time: ${time_total}s"
  
  if [[ "$http_code" != "200" ]]; then
    echo "FAIL: non-200 response"
    cat "$tmpfile" | python3 -m json.tool 2>/dev/null || cat "$tmpfile"
    rm "$tmpfile"
    fail+=1
    return 1
  fi
  
  local reply=$(cat "$tmpfile" | python3 -c "import sys,json; print(json.load(sys.stdin).get('reply',''))" 2>/dev/null)
  local confirmDraft=$(cat "$tmpfile" | python3 -c "import sys,json; print(json.load(sys.stdin).get('hints',{}).get('confirmDraft',''))" 2>/dev/null)
  local flexCount=$(cat "$tmpfile" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('hints',{}).get('flexMessages',[])))" 2>/dev/null)
  
  echo "reply: ${reply:0:120}"
  echo "confirmDraft: $confirmDraft"
  echo "flexCount: $flexCount"
  rm "$tmpfile"
  pass+=1
}

assert_contains() {
  local name="$1" haystack="$2" needle="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "PASS: $name"
  else
    echo "FAIL: $name — expected '$needle' in response"
    fail+=1
    pass-=1
  fi
}

assert_not_contains() {
  local name="$1" haystack="$2" needle="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "PASS: $name"
  else
    echo "FAIL: $name — did NOT expect '$needle' in response"
    fail+=1
    pass-=1
  fi
}

# --- Fresh UUIDs per test to eliminate history bleed ---
U1=$(uuidgen | tr '[:upper:]' '[:lower:]')
U2=$(uuidgen | tr '[:upper:]' '[:lower:]')
U3=$(uuidgen | tr '[:upper:]' '[:lower:]')
U4=$(uuidgen | tr '[:upper:]' '[:lower:]')
U5=$(uuidgen | tr '[:upper:]' '[:lower:]')
U6=$(uuidgen | tr '[:upper:]' '[:lower:]')
U7=$(uuidgen | tr '[:upper:]' '[:lower:]')

# Test 1: Fresh user greeting — must NOT be a morning briefing
run_test "T1: Fresh user hi" "$U1" "hi"
assert_not_contains "T1" "$reply" "Morning briefing"
assert_not_contains "T1" "$reply" "Your agenda"

# Test 2: Weather query
run_test "T2: Weather" "$U2" "what is the weather in Bangkok?"
assert_contains "T2" "$reply" "°C"

# Test 3: Stock quote
run_test "T3: Stock" "$U3" "what is NVIDIA stock price?"
assert_contains "T3" "$reply" "NVIDIA"

# Test 4: Draft email — must produce confirmDraft=true
run_test "T4: Draft email" "$U4" "draft an email to john@example.com saying hello and asking how he is"
assert_contains "T4" "$confirmDraft" "True"
assert_contains "T4" "$reply" "john@example.com"

# Test 5: Confirm draft with YES — must execute pending, NOT call morning briefing
run_test "T5: Confirm draft (YES)" "$U4" "yes"
assert_not_contains "T5" "$reply" "Morning briefing"
assert_not_contains "T5" "$reply" "Your agenda"
assert_contains "T5" "$reply" "Sent"  # pending runner logs sends

# Test 6: Thai greeting
run_test "T6: Thai" "$U5" "สวัสดี"
assert_contains "T6" "$reply" "สวัสดี"

# Test 7: Reminder
run_test "T7: Reminder" "$U6" "remind me to call mom tomorrow at 9am"
assert_contains "T7" "$reply" "reminder"

# Test 8: Cancel pending with NO
run_test "T8: Draft then cancel" "$U7" "draft an email to jane@example.com subject hi body hello"
run_test "T8b: Cancel (NO)" "$U7" "no"
assert_contains "T8b" "$reply" "Cancelled"

echo ""
echo "=========================="
echo "Passed: $pass  Failed: $fail"
echo "=========================="
