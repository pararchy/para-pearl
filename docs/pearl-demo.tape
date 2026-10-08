# Pearl demo — renders docs/demo.gif
# Run from the repo root:  vhs docs/pearl-demo.tape
# Uses dummy env vars — the savepoint gate fires before any network call,
# so no real Bubble app or token is needed for the demo.

Output docs/demo.gif

Set Shell "bash"
Set FontSize 18
Set Width 1200
Set Height 700
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 60ms

# Boot pi with Pearl loaded (dummy config — the gate is what we're showing)
Type 'export BUBBLE_APP_HOST=https://demo.bubbleapps.io BUBBLE_API_TOKEN=demo-token'
Enter
Sleep 500ms
Type 'pi -e extensions/bubble-api.ts -e extensions/savepoint-check.ts'
Enter
Sleep 4s

# 1. Show the wire
Type '/bubble'
Enter
Sleep 3s

# 2. The money shot — a destructive live write gets gated
Type 'pearl, delete the stale Session records on live'
Enter
Sleep 6s          # savepoint-check confirm dialog should appear
Sleep 1s
# decline the gate
Type 'n'
Enter
Sleep 3s

# 3. The ledger
Type '/pearl'
Enter
Sleep 3s

# outro
Type '/exit'
Enter
Sleep 2s
