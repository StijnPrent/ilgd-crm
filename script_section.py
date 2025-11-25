from pathlib import Path
text=Path('app/manager/settings/page.tsx').read_text()
start=text.index('<section id="company-settings"')
end=text.index('</section>', start)+len('</section>')
print(text[start:end])
