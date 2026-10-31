import pypdf,json,re,html,base64,io
from PIL import Image
U='/mnt/user-data/uploads/'
r=pypdf.PdfReader(U+'Be-Naseeb-Ishq_Saquib_Manuscript.pdf')
raw=[[l.strip() for l in p.extract_text().split('\n')] for p in r.pages]
E=html.escape
def trim(a):
    while a and not a[0]:a=a[1:]
    while a and not a[-1]:a=a[:-1]
    return a
body=[]
for i,l in enumerate(raw):
    if i: assert l[0]==str(i+1),(i,l[0]); l=l[1:]
    body.append(trim(l))
def stanzas(ls):
    out=[[]]
    for x in ls:
        if x=='':out.append([])
        else:out[-1].append(x)
    return [s for s in out if s]
def prose_pdf(i):
    ys=[]
    def v(t,cm,tm,fd,fs):
        if t.strip():ys.append((round(tm[5]),t.strip()))
    r.pages[i].extract_text(visitor_text=v)
    ys=ys[2:];paras=[[]];prev=None
    for y,t in ys:
        if prev is not None and prev-y!=168:paras.append([])
        paras[-1].append(t);prev=y
    return [' '.join(p) for p in paras if p]
def prose(ls):
    m=max(map(len,ls));paras=[[]]
    for x in ls:
        paras[-1].append(x)
        if re.search(r'[.?!”"]$',x) and len(x)<.82*m: paras.append([])
    return [' '.join(p) for p in paras if p]
pages=[];toc=[];part='Front matter';poems=0
inter=[i for i,l in enumerate(body) if i>4 and l[0]=='Safhon Ke Darmiyan']
partpg={l[0]:i for i,l in enumerate(body) if l[0].startswith('PART ') and len(l)==2}
poempg={l[0]:i for i,l in enumerate(body) if re.match(r'\d+\. ',l[0])}
ii=0
def tocentries():
    global ii
    ents=[]
    for i in (3,4):
        for x in body[i]:
            if x=='Contents':continue
            if x.startswith('PART '):ents.append(('part',x,partpg[x.split(' — ')[0]] if x.split(' — ')[0] in partpg else partpg[[k for k in partpg if k==x.split(' — ')[0]][0]]))
            elif x in poempg:ents.append(('poem',x,poempg[x]))
            elif x=='Safhon Ke Darmiyan':ents.append(('inter',x,inter[ii]));ii+=1
            else:ents.append(('end',x,46))
    return ents
ents=tocentries()
assert len(inter)==5 and len(poempg)==31 and ii==5
toc=[{'k':k,'t':t,'p':p} for k,t,p in ents]
for i,l in enumerate(body):
    h='';title='';fit=1;pn=i+1;cls=''
    if i==0:
        h='<div class="in tp"><div class="urt">بے نصیب عشق</div><div class="orn"></div><h1>Be-Naseeb Ishq</h1><p class="sub">A Poetry Collection</p><p class="sub">Roman Urdu</p><p class="au">SAQUIB</p></div>';title='Title';pn=None
    elif i==1:
        g=[]
        for x in l[1:]:
            if x.startswith(('Un ','Aur ')) or not g:g.append([])
            g[-1].append(x)
        h='<div class="in"><h2>Dedication</h2><div class="orn"></div>'+''.join('<div class="v c">'+''.join(f'<span class="l">{E(x)}</span>' for x in s_)+'</div>' for s_ in g)+'</div>';title='Dedication'
    elif i==2:
        ps=prose_pdf(i);h=f'<div class="in"><h2>Preface</h2><div class="orn"></div><p class="lead">{E(ps[0])}</p>'+''.join(f'<p>{E(x)}</p>' for x in ps[1:])+'</div>';title='Preface'
    elif i in(3,4):
        part_=''
        def lk(k,t,p):return f'<a href="#" data-go="{p}" class="{k}">{E(t)}</a>'
        sub=[(k,t,p) for (k,t,p) in ents if (i==3)==(ents.index((k,t,p))<[j for j,e in enumerate(ents) if e[1].startswith('PART IV')][0]-1)]
        h='<div class="in toc">'+('<h2>Contents</h2><div class="orn"></div>' if i==3 else '')+''.join(lk(*e) for e in sub)+'</div>';title='Contents'
    elif l[0].startswith('PART ') and len(l)==2:
        part=l[0].title().replace('Part ','Part ')+' — '+l[1].split(' — ')[0];part=part.replace('Part I ','Part I ')
        h=f'<div class="in part"><div class="pt">{E(l[0])}</div><div class="orn"></div><div class="ps">{E(l[1])}</div></div>';title=l[0]+' · '+l[1];pn=None
    elif re.match(r'\d+\. ',l[0]):
        h=f'<div class="in"><h3>{E(l[0])}</h3><div class="orn s"></div>'+''.join('<div class="v">'+''.join(f'<span class="l">{E(x)}</span>' for x in s)+'</div>' for s in stanzas(l[1:]))+'</div>';title=l[0]
    else:
        ps=prose_pdf(i);sig=''
        out=''
        k=0
        for x in ps:
            if x.startswith('—'):
                out+=f'<p class="sg{" r" if k else ""}">{E(x)}</p>';k+=1
            else:out+=f'<p>{E(x)}</p>'
        h=f'<div class="in"><h2 class="{"it" if l[0].startswith("Safhon") else ""}">{E(l[0])}</h2><div class="orn"></div>{out}</div>';title=l[0]
    pn_h=f'<div class="pn">{pn}</div>' if pn else ''
    pages.append({'h':f'<div class="pg" data-fit="1">{h}{pn_h}</div>','t':title,'c':part if i>4 else 'Front matter'})

UD=str.maketrans('0123456789','۰۱۲۳۴۵۶۷۸۹')
blocks=[b for b in open('ur.txt').read().split('## ')[1:]]
ub=[(b.split('\n',1)[0].strip(),b.split('\n',1)[1].strip('\n').split('\n')) for b in blocks]
upages=[];ut={};ci=0;upart='تمہید'
def htitle(t):return re.sub(r'^(\d+)\. ',lambda m:m.group(1)+'۔ ',t).translate(UD)
for i in range(N0:=len(pages)):
    pn=i+1;cls=''
    if i==0:
        h='<div class="in tp"><div class="urt">بے نصیب عشق</div><div class="orn"></div><h1>ایک شعری مجموعہ</h1><p class="sub">رومن اردو سے اردو رسم الخط</p><p class="au">ثاقب</p></div>';title='عنوان';pn=None
    elif i in(3,4):
        upages.append((None,'فہرست',pn,i));continue
    else:
        typ,ln=ub[ci];ci+=1
        if typ=='d':
            g=[[]]
            for x in ln[1:]:
                if x=='':g.append([])
                else:g[-1].append(x)
            h=f'<div class="in"><h2>{ln[0]}</h2><div class="orn"></div>'+''.join('<div class="v c">'+''.join(f'<span class="l">{E(x)}</span>' for x in s_)+'</div>' for s_ in g if s_)+'</div>';title=ln[0]
        elif typ=='part':
            upart=ln[0]+' — '+ln[1].split(' — ')[0]
            h=f'<div class="in part"><div class="pt">{E(ln[0])}</div><div class="orn"></div><div class="ps">{E(ln[1])}</div></div>';title=ln[0]+' · '+ln[1];pn=None
        elif typ=='v':
            title=htitle(ln[0])
            h=f'<div class="in"><h3>{E(title)}</h3><div class="orn s"></div>'+''.join('<div class="v">'+''.join(f'<span class="l">{E(x)}</span>' for x in s_)+'</div>' for s_ in stanzas(ln[1:]))+'</div>'
        else:
            title=ln[0];out='';k=0;first=(title=='پیش لفظ')
            for j,x in enumerate(ln[1:]):
                if x.startswith('—'):out+=f'<p class="sg{" r" if k else ""}">{E(x)}</p>';k+=1
                elif first and j==0:out+=f'<p class="lead">{E(x)}</p>'
                else:out+=f'<p>{E(x)}</p>'
            h=f'<div class="in"><h2>{E(title)}</h2><div class="orn"></div>{out}</div>'
        # consistency check vs English
        if typ=='v':
            ec=[len(z) for z in stanzas(body[i][1:])];uc=[len(z) for z in stanzas(ln[1:])]
            if ec!=uc:print('STANZA MISMATCH',i+1,ec,uc)
        elif typ=='p':
            ep=len(prose_pdf(i));
            if ep!=len(ln)-1:print('PARA MISMATCH',i+1,ep,len(ln)-1)
    ut[i]=(upart_full:=title) if False else title
    if i>4 and typ=='part':ut[i]=ln[0]+' — '+ln[1]
    upages.append((h,title,pn,i))
cut=[j for j,e in enumerate(toc) if e['t'].startswith('PART IV')][0]-1
def tochtml(i):
    sub=toc[:cut] if i==3 else toc[cut:]
    return '<div class="in toc">'+('<h2>فہرست</h2><div class="orn"></div>' if i==3 else '')+''.join(f'<a href="#" data-go="{e["p"]}" class="{e["k"]}">{html.escape(ut[e["p"]])}</a>' for e in sub)+'</div>'
upages=[(tochtml(i) if h is None else h,t,pn,i) for h,t,pn,i in upages]
UP=[]
cur='تمہید';
for h,title,pn,i in upages:
    if title.startswith('حصہ'):cur=title.split(' · ')[0]+' — '+title.split(' · ')[1].split(' — ')[0]
    pnh=f'<div class="pn">{str(pn).translate(UD)}</div>' if pn else ''
    UP.append({'h':f'<div class="pg ur" data-fit="1" dir="rtl">{h}{pnh}</div>','t':title,'c':cur if i>4 else 'تمہید'})
UT=[{'k':e['k'],'t':ut[e['p']],'p':e['p']} for e in toc]
im=Image.open(U+'Be-Naseeb_Ishq_Poetry_Collection.png').convert('RGB')
c=im.crop((828,0,1536,1024)).resize((620,897));b=io.BytesIO();c.save(b,'JPEG',quality=82)
cover='data:image/jpeg;base64,'+base64.b64encode(b.getvalue()).decode()
t=open('tpl.html').read()
t=t.replace('__COVER__',cover).replace('__PAGES__',json.dumps(pages,ensure_ascii=False)).replace('__TOC__',json.dumps(toc,ensure_ascii=False)).replace('__PAGES_UR__',json.dumps(UP,ensure_ascii=False)).replace('__TOC_UR__',json.dumps(UT,ensure_ascii=False))
open('/mnt/user-data/outputs/be-naseeb-ishq.html','w').write(t)
print(len(pages),len(t)//1024,'KB');print([ (p['t'],p['c']) for p in pages[:12]]);print(toc[:3])

import os
if os.environ.get('EXPORT'):
    d=os.environ['EXPORT']
    json.dump({'pages':pages,'toc':toc},open(d+'/data/book.en.json','w'),ensure_ascii=False)
    json.dump({'pages':UP,'toc':UT},open(d+'/data/book.ur.json','w'),ensure_ascii=False)
    c.save(d+'/public/cover.jpg','JPEG',quality=85)
