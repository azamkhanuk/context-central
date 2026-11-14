---
type: regex
pattern: 'export-stalled|\balert\w*[^.]{0,80}(?:\bevery (?:try|retry|attempt)\b|\ball (?:\w+ ){0,3}(?:tries|retries|attempts)\b|\bout of (?:tries|retries|attempts)\b|\bexhaust\w*)|(?:\bevery (?:try|retry|attempt)\b|\ball (?:\w+ ){0,3}(?:tries|retries|attempts)\b|\bout of (?:tries|retries|attempts)\b|\bexhaust\w*)[^.]{0,80}\balert\w*|\b(?:alert|notif)\w*[^.]{0,80}\bteam\b|\bteam\b[^.]{0,80}\b(?:alert|notif)\w*|\balert\w*[^\w.]+(?:\w+[^\w.]+){0,2}(?:in|to|inside|within|on)[^\w.]+(?:the[^\w.]+)?api\b|\bapi\W{1,3}alert|\bon in (?:the )?prod(?:uction)?\b|(?:\b(?:switch|turn)\w*\b[^.\n]{0,30}\bon\b|\benabl\w+|\bactivat\w+|\bgo(?:es|ing)? live\b)[^.]{0,60}\bprod(?:uction)?\b|\bprod(?:uction)?\b[^.]{0,60}(?:\b(?:switch|turn)\w*\b[^.\n]{0,30}\bon\b|\benabl\w+|\bactivat\w+|\bgo(?:es|ing)? live\b)'
flags: i
---
