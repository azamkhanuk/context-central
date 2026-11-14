---
type: tool_used
tool: Grep
input_match: '^(?![\s\S]*"path"\s*:\s*"(?:[^"]*/cwd/|\./)?(?:web|api|billing|worker)(?:/[^"]*)?")(?![\s\S]*"glob"\s*:\s*"(?:(?:\./)?(?:web|api|billing|worker)/|(?![^"]*\b(?:md|json)\b)[^"]*\.))(?![\s\S]*"type"\s*:\s*"(?!md"|markdown"|json")\w+")[\s\S]*"output_mode"\s*:\s*"content"'
min: 0
max: 0
---
