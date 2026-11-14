---
type: regex
pattern: '\b(?:five|5)\W{0,4}(?:tries|attempts?|retries|x\b)|(?:\btr(?:y|ied|ies)|\bretr(?:y|ied|ies)|\battempt\w*)\b[^.\n]{0,40}\b(?:five|5)\W{0,4}times|\bprod(?:uction)?\b[^.]{0,60}(?:\boff\b|\bdisabled\b|\binactive\b|(?:\bnot|n.t)\b[^.\n]{0,20}\b(?:on|enabled|live|running|active|activated)\b)|(?:\boff\b|\bdisabled\b|\binactive\b|(?:\bnot|n.t)\b[^.\n]{0,20}\b(?:on|enabled|live|running|active|activated)\b)[^.]{0,60}\bprod(?:uction)?\b'
flags: i
---
