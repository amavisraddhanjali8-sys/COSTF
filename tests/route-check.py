import re,glob,sys
srv=set()
src=open('server.ts').read()
for m in re.finditer(r"app\.(get|post|put|delete|patch)\(\s*(\[[^\]]*\]|'[^']*')",src):
    for r in [x for x in re.findall(r"'([^']*)'",m.group(2)) if x.startswith('/api')]: srv.add((m.group(1).upper(),r))
def rx(r): return re.compile('^'+re.sub(r':[A-Za-z]+','[^/]+',r)+'$')
cl=set()
for f in glob.glob('src/**/*.ts*',recursive=True):
    t=open(f).read()
    # fetch with method nearby
    for m in re.finditer(r"fetch\(\s*[`'\"](/api/[^`'\"]*)[`'\"]\s*(?:,\s*\{([^}]*)\})?",t,re.S):
        path=re.sub(r'\$\{[^}]*\}','x',m.group(1)).split('?')[0]
        meth=re.search(r"method:\s*'(\w+)'",m.group(2) or '')
        cl.add((meth.group(1) if meth else 'GET',path,f))
bad=0
for meth,path,f in sorted(cl):
    if not any(m==meth and rx(r).match(path) for m,r in srv):
        anym=[m for m,r in srv if rx(r).match(path)]
        print(f"MISSING {meth} {path}  ({f})" + (f"  server has: {anym}" if anym else '')); bad+=1
print(f"{len(cl)} client calls, {bad} without matching server route")
