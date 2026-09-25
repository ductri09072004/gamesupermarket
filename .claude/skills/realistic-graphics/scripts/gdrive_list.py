import re, subprocess, sys, codecs
def listing(fid):
    html = subprocess.run(['curl','-s','-m','30','-A','Mozilla/5.0',f'https://drive.google.com/drive/folders/{fid}'],capture_output=True,text=True).stdout
    m = re.search(r"window\['_DRIVE_ivd'\] = '([^']*)'", html)
    if not m: return []
    s = codecs.decode(m.group(1).replace('\\/','/'), 'unicode_escape')
    return re.findall(r'\["([A-Za-z0-9_-]{25,})",\["'+re.escape(fid)+r'"\],"([^"]+)","([^"]+)"', s)
if __name__ == '__main__':
    for i,n,t in listing(sys.argv[1]): print(i, n, t)
