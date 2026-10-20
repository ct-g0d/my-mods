import json, sys
sp = json.load(open(sys.argv[1]))
out = sys.argv[2]
# name: (sprite, speed, first frame only)
SPEC = {
    'Idle': ('LookingAround', 1, True),
    'LookAround': ('LookingAround', 0.4, False),
    'Thinking': ('Thinking', 0.6, False),
    'Typing': ('Laptop', 0.8, False),
    'Computer': ('Desktop', 0.8, False),
    'Searching': ('LookingAround', 0.8, False),
    'Fetching': ('Running', 0.8, False),
    'Delegating': ('Pointing', 0.8, False),
    'Asking': ('Waving', 0.8, False),
    'Skill': ('Lightbulb', 0.8, False),
    'Busy': ('Spark', 0.8, False),
    'Oops': ('Dizzy', 1, False),
    'Done': ('JumpingHappy', 1, False),
    'BigDone': ('BreakDancing', 1, False),
    'Sad': ('Disappointed', 1, False),
}
sp = {name: dict(sp[src], frames=sp[src]['frames'][:1] if still else sp[src]['frames'], speed=speed) for name, (src, speed, still) in SPEC.items()}
FORMS = list(SPEC)
SCALE = 23 / 17  # Clawd's size, kept from before
def anchor(v):
    a = v['a0'] if v['a0'][2] > 0 else [0, 0, v['w'], v['h']]
    return a[0] + a[2] / 2, a[1] + a[3]
def keep(v):
    w = v['w']; a = v['a0'] if v['a0'][2] > 0 else [0, 0, w, v['h']]
    return [f for f in v['frames'] if min(i // w for i, c in enumerate(f) if c != 255) >= a[1] - 1]
def rows(v):
    w = v['w']; ys = [i // w for f in v['frames'] for i, c in enumerate(f) if c != 255]
    return min(ys), max(ys) + 1
# common canvas: anchor at (cx, cy)
left = max(anchor(sp[n])[0] for n in FORMS); right = max(sp[n]['w'] - anchor(sp[n])[0] for n in FORMS)
top = max(anchor(sp[n])[1] - rows(sp[n])[0] for n in FORMS); bottom = max(rows(sp[n])[1] - anchor(sp[n])[1] for n in FORMS)
CW, CH = left + right, top + bottom
def paths(frame, w, pal, dx, dy):
    by = {}
    for y in range(len(frame) // w):
        x = 0
        while x < w:
            c = frame[y * w + x]
            if c == 255: x += 1; continue
            s = x
            while x < w and frame[y * w + x] == c: x += 1
            by.setdefault(c, []).append(f'M{s+dx:g} {y+dy:g}h{x-s}v1h-{x-s}z')
    return ''.join(f'<path fill="{pal[c]}" d="{"".join(d)}"/>' for c, d in by.items())
res, durations, heights = {}, {}, {}
for n in FORMS:
    v = sp[n]; ax, ay = anchor(v); dx, dy = left - ax, top - ay
    runs = []
    for f in v['frames']:
        if runs and runs[-1][0] == f: runs[-1][1] += 1
        else: runs.append([f, 1])
    total = sum(r[1] for r in runs); T = total / (v['fps'] * v['speed'])
    body, t = [], 0
    for f, k in runs:
        a, b = t / total, (t + k) / total; t += k
        if len(runs) == 1: anim = ''
        elif a == 0: anim = f'<animate attributeName="visibility" calcMode="discrete" values="visible;hidden" keyTimes="0;{b:.4f}" dur="{T:.3f}s" repeatCount="indefinite"/>'
        else: anim = f'<animate attributeName="visibility" calcMode="discrete" values="hidden;visible;hidden" keyTimes="0;{a:.4f};{min(b,1):.4f}" dur="{T:.3f}s" repeatCount="indefinite"/>'
        vis = '' if a == 0 else ' visibility="hidden"'
        body.append(f'<g{vis}>{anim}{paths(f, v["w"], v["palette"], dx, dy)}</g>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CW:g} {CH:g}" width="{CW*SCALE:g}" height="{CH*SCALE:g}" '
           f'shape-rendering="crispEdges">{"".join(body)}</svg>')
    res[n] = svg
    durations[n] = round(T * 1000)
    print(n, len(runs), 'frames', len(svg), 'chars')
open(out, 'w', encoding='utf-8').write(
    '// Generated from the Claude desktop app\'s own Clawd sprite data. Do not edit by hand.\n'
    f'export const WIDTH = {CW*SCALE:g}\nexport const HEIGHT = {CH*SCALE:g}\n'
    f'export const DURATION_MS: Record<string, number> = {json.dumps(durations)}\n'
    f'export const FORMS: Record<string, string> = {json.dumps(res, indent=0)}\n')
print('canvas', CW, CH)
