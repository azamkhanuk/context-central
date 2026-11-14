---
type: regex
pattern: 'export-stalled|\balert[^.\n]{0,80}(?:fail|every try)|(?:fail|every try)[^.\n]{0,80}\balert|\bnotif[^.\n]{0,80}(?:fail|every try)|(?:switch|turn)(?:ing)? (?:the retry|retries|it) (?:back )?on\b|(?:switch|turn)(?:ing)? on (?:the retry|retries)\b|\benabl(?:e|ing) (?:the retry|retries)\b'
flags: i
---
