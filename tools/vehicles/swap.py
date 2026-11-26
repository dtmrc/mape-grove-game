# python3 swap.py file 'marker' < new_block   : replace the section starting at the line containing marker up to the next "  // " section comment
import sys
f, marker = sys.argv[1], sys.argv[2]; new = sys.stdin.read().rstrip('\n') + '\n'
L = open(f).read().split('\n')
i = next(k for k, l in enumerate(L) if marker in l)
j = next((k for k in range(i + 1, len(L)) if L[k].startswith('  // ') or L[k].startswith('  return vMats') or L[k].startswith('  if (o.police) return') or any(t in L[k] for t in ('K.handles(', 'K.mirrors(', 'K.wheels(', 'K.bodySide('))), len(L))
open(f, 'w').write('\n'.join(L[:i]) + '\n' + new + '\n'.join(L[j:]))
print(f, 'replaced lines', i + 1, '-', j)
