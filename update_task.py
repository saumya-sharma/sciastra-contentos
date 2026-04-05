import sys

with open('../../../brain/a586d074-aec9-4c10-b17b-9f959007e21b/task.md', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace('- `[ ]` **Priority 2:', '- `[x]` **Priority 2:')
code = code.replace('- `[ ]` **Priority 4:', '- `[x]` **Priority 4:')
for target in [
    '- [ ] Add WATI feature flag mechanism',
    '- [ ] Wire `/api/notify` backend',
    '- [ ] Record database logs',
    '- [ ] Inject notification history',
    '- [ ] Upgrade Cheerio scripts',
    '- [ ] Provide Admin UI manual "Trigger Sync"'
]:
    code = code.replace(target, target.replace('- [ ] ', '- [x] '))

with open('../../../brain/a586d074-aec9-4c10-b17b-9f959007e21b/task.md', 'w', encoding='utf-8') as f:
    f.write(code)

print("Tasks marked complete")
